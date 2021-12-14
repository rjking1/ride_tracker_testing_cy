export function isLocalDB() {
  return Cypress.env("FRONTEND_URL").includes("localhost");
}

export function executeSQL(sql) {
  if (isLocalDB()) {
    cy.log("Executing SQL: " + sql);
    cy.task("dbQuery", {
      query: sql,
      params: [],
    });
  }
}

export function loadDataFile(fileName) {
  if (isLocalDB()) {
    cy.log("Loading data from file " + fileName);
    cy.readFile(fileName).then((f) => {
      const rows = f.replace(/\r\n/g, "\n").split(";\n");
      rows.forEach((sql) => {
        cy.log("executing SQL: " + sql.substr(0, 80) + "...");
        cy.task("dbQuery", {
          query: sql,
          params: [],
        });
      });
    });
  }
}

export function generateFeatureAndScenarios(tsvFileName, featureFileName) {
  // converts each test row in the tsv file to a scenario in the feature file

  const TSV_FILE_LOCATION = "./cypress/driver/";
  const FEATURE_FILE_LOCATION = "./cypress/integration/";

  let lookingForHeader = true;
  let header;
  let skippingTests = false;
  let scenarios =
    "Feature: scenarios auto generated from " +
    tsvFileName +
    ".\n\n# Any edits you make to this file will be lost if this file is regenerated #";

  cy.readFile(TSV_FILE_LOCATION + tsvFileName).then((tsv) => {
    const testRows = tsv.replace(/\r\n/g, "\n").split("\n");
    testRows.forEach((row) => {
      row = row.trim();
      // skipping just means the generated scenarios are marked @skip
      if (row.toLowerCase() == "*skip") {
        skippingTests = true;
      } else if (row.toLowerCase() == "*skip if local" && isLocalDB()) {
        // use a regex to allow whitepace
        skippingTests = true;
      } else if (row.toLowerCase() == "*skip if uat" && !isLocalDB()) {
        skippingTests = true;
      } else if (row.toLowerCase() == "*end skip") {
        skippingTests = false;
      }

      if (row.startsWith("' ")) {
        scenarios += "\n" + row.substr(2);
      } else if (row.startsWith("*")) {
        scenarios += "\n# " + row;
      } else if (row == "" || row.startsWith("#") || row.startsWith("@")) {
        scenarios += "\n" + row;
      } else {
        if (lookingForHeader) {
          header = row.split("\t");
          lookingForHeader = false;
          // scenarios += '\n# ' + row;  // no need for col headers as we don't pass col values into generated file
        } else {
          let items = row.split("\t");
          let data = {};
          header.forEach((col, index) => {
            data[col] = items[index];
          });

          cy.log("Writing scenario: Test ", data.TestName);
          if (skippingTests) {
            scenarios += "\n@skip ";
          }
          scenarios +=
            "\nScenario: " +
            data.TestName +
            `\n  Then Run test '${data.TestName}' in '${tsvFileName}'`;
        }
      }
    });
    cy.writeFile(
      FEATURE_FILE_LOCATION + featureFileName + ".feature",
      scenarios
    );
  });
}

export function runTests(tsvFileName, runTest, testNameColumn, testNumber) {
  let lookingForHeader = true;
  let header;
  let skippingTests = false;
  cy.readFile(tsvFileName).then((tsv) => {
    const testRows = tsv.replace(/\r\n/g, "\n").split("\n");
    testRows.forEach((row) => {
      // skip blank rows and rows starting # (comment)
      row = row.trim();
      if (row.toLowerCase() == "*skip") {
        skippingTests = true;
      } else if (row.toLowerCase() == "*skip if local" && isLocalDB()) {
        // use a regex to allow whitepace
        skippingTests = true;
      } else if (row.toLowerCase() == "*skip if uat" && !isLocalDB()) {
        skippingTests = true;
      } else if (row.toLowerCase() == "*end skip") {
        skippingTests = false;
      } else if (row.startsWith("'")) {
        cy.log(
          "Warning: lines starting with ' are ignored if a tsv file is directly run.  Run the generated file."
        );
      } else if (!row.startsWith("#") && !(row == "")) {
        if (lookingForHeader) {
          header = row.split("\t");
          lookingForHeader = false;
        } else {
          let items = row.split("\t");
          let data = {};
          header.forEach((col, index) => {
            data[col] = items[index];
          });
          if (!testNameColumn || data[testNameColumn] == testNumber) {
            if (skippingTests) {
              cy.log("SKIPPING test: ", JSON.stringify(data));
            } else {
              cy.log("Running test:  ", JSON.stringify(data));
              runTest(data);
            }
          }
        }
      }
    });
  });
}

export function runTestInTSV(
  testName,
  tsvFileName,
  testFunction,
  testNameColumn = "TestName"
) {
  cy.readFile("./cypress/driver/" + tsvFileName).then((tsv) => {
    let lookingForHeader = true;
    let header;

    tsv
      .replace(/\r\n/g, "\n")
      .split("\n")
      .forEach((row) => {
        // skip blank rows and rows starting # (comment)
        row = row.trim();
        if (row.startsWith("'")) {
          // ignore these lines in the tsv file
        } else if (!row.startsWith("#") && !(row == "")) {
          if (lookingForHeader) {
            header = row.split("\t");
            lookingForHeader = false;
          } else {
            let items = row.split("\t");
            let data = {};
            header.forEach((col, index) => {
              data[col] = items[index];
            });
            if (data[testNameColumn] == testName) {
              cy.log("Running test:  ", JSON.stringify(data));
              if (data[testNameColumn].startsWith("# *")) {
                data[testNameColumn] = data[testNameColumn].substr(2); // strip # <space> off
              }
              testFunction(data); // callback user supplied function to drive UI with row data
              // ranTest = true;
            }
          }
        }
      });
  });
}

// compares two csv files
// does a string compare of the entire file
// if different then compares line by line,
// then item by item to allow for tolerance and date variations
// - doesn't support quoted items atm
export function compareFiles(
  actualFileName,
  expectedFileName,
  tolerance = 0.001,
  willFail = false
) {
  cy.readFile(actualFileName).then((actual) => {
    cy.readFile(expectedFileName).then((expected) => {
      // strip CRs leaving only LFs (Windows / Unix)
      actual = actual.replace(/\r\n/g, "\n");
      expected = expected.replace(/\r\n/g, "\n");

      // for speed first check if files are identical
      if (actual != expected) {
        if (willFail) {
          cy.log("** Actual differs from Expected ; IGNORED **");
          return;
        }
        // not equal -- check line by line
        // do our own check so we only get failures reported
        // is there not a better way?
        const actuals = actual.split("\n");
        const expecteds = expected.split("\n");

        // check line counts
        if (actuals.length != expecteds.length) {
          expect(actuals.length).to.equal(expecteds.length);
        } else {
          actuals.forEach((aline, index) => {
            const eline = expecteds[index];
            if (aline != eline) {
              // actual line is not equal to expected line when doing a string compare
              // so compare item by item (comma separated)
              // as floats might be witin tolerance and dates might be equal (just formatted differently)
              cy.log("Lines differ", [aline, eline]);
              const aitems = aline.split(",");
              const eitems = eline.split(",");
              let okay = true; // assume good until we find a bad item match
              aitems.forEach((aitem, index2) => {
                const eitem = eitems[index2];
                cy.log("Items", [aitem, eitem]);
                if (okay) {
                  if (aitem != eitem) {
                    let itemOkay = false;
                    // try to compare as floats
                    if (eitem.match(/-?\d+\.\d+/)) {
                      itemOkay =
                        Math.abs(parseFloat(aitem) - parseFloat(eitem)) <=
                        tolerance;
                      if (itemOkay) {
                        cy.log("but items are within tolerance");
                      } else {
                        cy.log("out of tolerance");
                      }
                    }
                    // try to compare as dates
                    // match on ISO YYYY-MM-DD with space or T... or Australian DD/MM/YYYY...
                    else if (eitem.match(/^\d{2,4}.\d{2}.\d{2,4}.*/)) {
                      cy.log(aitem, eitem);
                      itemOkay = parseDate(aitem) == parseDate(eitem);
                      if (itemOkay) {
                        cy.log("but dates match");
                      } else {
                        cy.log("dates mismatch");
                      }
                    }
                    okay &= itemOkay;
                  }
                }
              });
              if (!okay) {
                expect(aline).to.equal(eline);
              }
            }
          });
        }
      }
    });
  });
}

function parseDate(dateString) {
  // returns ISO date without a T in all cases

  // if DD MM YYYY... convert Autralian date to ISO
  if (dateString.match(/^\d{2}.\d{2}.\d{4}.*/)) {
    const m = dateString.match(/^(\d{2}).(\d{2}).(\d{4})(.*)/);
    return m[3] + "-" + m[2] + "-" + m[1] + m[4];
  } else {
    // else assume ISO and remove the 'T' before time if it exists
    return dateString.replace("T", " ");
  }
}

export function exportTableToCSV(tableSelector, filename) {
  // todo fix this has a problem that it exports all rows -- even those filterd out (hidden)
  let csv = [];
  tableSelector
    .find("tr:visible", { log: false })
    .each((el) => {
      let row = [];
      cy.wrap(el, { log: false })
        .find("td,th", { log: false })
        .each((cell) => {
          row.push('"' + cell.text() + '"');
        })
        .then(() => {
          csv.push(row.join(","));
        });
    })
    .then(() => {
      downloadCSV(csv.join("\n"), filename);
    });
}

function downloadCSV(csv, filename) {
  let csvFile;
  let downloadLink;

  csvFile = new Blob([csv], { type: "text/csv" });
  downloadLink = document.createElement("a");
  downloadLink.download = filename;
  downloadLink.href = window.URL.createObjectURL(csvFile);
  downloadLink.style.display = "none";
  document.body.appendChild(downloadLink);
  downloadLink.click();
}

export function compareFilesUsingRegExp(
  actualFileName,
  expectedFileName,
  rows = 99999999
) {
  // this function compares only as many rows as there are in the expected file
  // the remainder of the actual file is not checked
  // (this is to provide a means of having "don't care" fields and rows)
  // the expected file rows are treated as RegExp's
  // see 7000 tests for usage
  cy.readFile(actualFileName).then((actual) => {
    cy.readFile(expectedFileName).then((expected) => {
      // strip CRs leaving only LFs (Windows / Unix)
      actual = actual.replace(/\r\n/g, "\n");
      expected = expected.replace(/\r\n/g, "\n");

      // check line by line using RegExp
      const actuals = actual.split("\n");
      const expecteds = expected.split("\n");

      // only compare at most the number of lines in expected results file
      // or a maxiumum of <rows>
      expecteds.forEach((expectedLine, index) => {
        const actualLine = actuals[index];
        if (index < rows) {
          expect(actualLine).to.match(new RegExp(expectedLine));
        }
      });
    });
  });
}

export function exportPartialDOMToFile(selector, filename) {
  // this is a poor mans DOM snapshot comparison
  // but it does the job
  // will use an official cypress snapshot function/command when we can
  cy.get(selector).then(($el) => {
    downloadCSV($el.get(0).outerHTML, filename); // todo rename downloadCSV to be more general
  });
}

// don't use this routine until properly tested!
export function compareFilesWithIgnoreOption(a, e, ignoreCols = [-1]) {
  // let alines =
  cy.readFile(a).then((actual) => {
    cy.readFile(e).then((expected) => {
      let a = actual.split("\n");
      let e = expected.split("\n");
      for (let i = 0; i++; i < a.length) {
        if (i in ignoreCols) {
        } else {
          expect(a[i]).to.equal(e[i]);
        }
      }
    });
  });
}

export function random(length = 8) {
  return Math.random().toString(16).substr(2, length);
}

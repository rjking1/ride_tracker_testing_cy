import { And, Then } from "cypress-cucumber-preprocessor/steps";
import {
  compareFilesUsingRegExp,
  exportPartialDOMToFile,
  exportTableToCSV,
} from "../common/utils.js";

And("I login to Ride Tracker", () => {
  cy.visit(Cypress.env("RIDE_TRACKER_URL"));
  cy.get("#db").focus().clear().type(Cypress.env("DB_NAME"));
  cy.get("#user").focus().clear().type(Cypress.env("DEV_NAME"));
  cy.get("#password").focus().clear().type(Cypress.env("DEV_PASSWORD"));
  cy.get("#login").click();
  // eslint-disable-next-line cypress/no-unnecessary-waiting
  cy.wait(1000);
});

And("check the stats are within reason", () => {
  const fileName = "ride_tracker.csv";
  // eslint-disable-next-line cypress/no-unnecessary-waiting
  cy.wait(2000);
  exportPartialDOMToFile("pre", fileName);
  compareFilesUsingRegExp(
    `./cypress/downloads/${fileName}`,
    `./cypress/expected/${fileName}`
  );
});

And("add a ride", () => {
  cy.contains("Add").click();
  cy.get("#id_km").focus().clear().type("99");
  cy.get("#id_alt").focus().clear().type("1234");
  cy.get("#id_desc").focus().clear().type("test ride");
  cy.get("#id_weather").focus().clear().type("sunny");
  cy.contains("Add Ride").click();
});

And("check the ride is the most recent", () => {
  exportTableToCSV(cy.get("table"), "rides.csv");
  compareFilesUsingRegExp(
    "./cypress/downloads/rides.csv",
    "./cypress/expected/rides.csv",
    2
  );
});

And("edit a ride", () => {
  cy.contains("✎ Edit").click();
  cy.get("#id_km").focus().clear().type("88");
  cy.get("#id_alt").focus().clear().type("1111");
  cy.get("#id_desc").focus().clear().type("test ride edited");
  cy.get("#id_weather").focus().clear().type("rainy");
  cy.contains("Update").click();
});

And("check the ride has been edited correctly", () => {
  exportTableToCSV(cy.get("table"), "rides2.csv");
  compareFilesUsingRegExp(
    "./cypress/downloads/rides2.csv",
    "./cypress/expected/rides2.csv",
    2
  );
});

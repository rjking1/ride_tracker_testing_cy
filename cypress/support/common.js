import { POST_PHP } from "./config.js";

// export async function doFetchGet(db, sql) {
//   let resp = await fetch(
//     GET_PHP + '?db=' + db + '&sql=' + sql,
//   )
//   return await resp.json()
// }

export async function doFetch(db, sql, auditText) {
  let formData = new FormData();
  formData.append("db", db);
  formData.append("sql", encodeURI(sql));
  if (auditText) {
    formData.append("audit_text", auditText);
  }
  //formData.append('noenc', 'true')

  let resp = await fetch(POST_PHP, {
    method: "POST",
    body: formData,
  });
  let j = await resp.json();
  //console.log(j)
  return j;
}

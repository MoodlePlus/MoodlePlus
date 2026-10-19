// Parses a WolfWare/Moodle gradebook/grades page for the grade calculator.
// TODO: extract graded/ungraded items and weights from the gradebook DOM.
/**
 * 
 * @param {*} id - course id
 */
export async function parseGradebook(id) {
  // TODO: implement gradebook parsing logic
try{
  const response = await fetch(`/grade/report/user/index.php?id=${id}`);
  // Read HTML
  const html = await response.text();

  // Check whether the response contains the grade table
  const doc = new DOMParser().parseFromString(html, "text/html");
  const table = doc.querySelector("table.user-grade");

  // A table displayed... further parsing wil be done later.
  // have to also
  console.log(table);
}catch (error){
  throw new Error("Refresh Page")
}
}

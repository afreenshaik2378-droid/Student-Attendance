const STORAGE_KEY = "studentAttendanceManagerV1";
const $ = (id) => document.getElementById(id);
const today = new Date();
const localDate = new Date(today.getTime() - today.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
$("attendanceDate").value = localDate;

let state = loadState();
let attendanceDraft = {};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.students) && saved.attendance) return saved;
  } catch (error) { console.warn("Could not load saved data", error); }
  return { students: [], attendance: {} };
}
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function dateRecords(date) {
  return state.attendance[date] || {};
}
function getPercentage(roll) {
  let present = 0, recorded = 0;
  for (const day of Object.values(state.attendance)) {
    if (day[roll] === "Present" || day[roll] === "Absent") {
      recorded++;
      if (day[roll] === "Present") present++;
    }
  }
  return recorded ? Math.round((present / recorded) * 100) : 0;
}
function render() {
  const date = $("attendanceDate").value || localDate;
  const records = dateRecords(date);
  const query = $("searchInput").value.trim().toLowerCase();
  const present = state.students.filter(s => (attendanceDraft[s.roll] ?? records[s.roll]) === "Present").length;
  const absent = state.students.filter(s => (attendanceDraft[s.roll] ?? records[s.roll]) === "Absent").length;
  const marked = present + absent;
  $("totalStudents").textContent = state.students.length;
  $("presentToday").textContent = present;
  $("absentToday").textContent = absent;
  $("attendanceRate").textContent = marked ? `${Math.round(present / marked * 100)}%` : "0%";

  const visible = state.students.filter(s =>
    s.name.toLowerCase().includes(query) || s.roll.toLowerCase().includes(query));
  if (!visible.length) {
    $("studentTable").innerHTML = `<tr><td colspan="5" class="empty">${state.students.length ? "No students match your search." : "No students added yet. Add a student above to begin."}</td></tr>`;
    return;
  }
  $("studentTable").innerHTML = visible.map(s => {
    const status = attendanceDraft[s.roll] ?? records[s.roll] ?? "";
    return `<tr>
      <td>${escapeHtml(s.roll)}</td><td>${escapeHtml(s.name)}</td>
      <td><select class="status-select" data-roll="${escapeHtml(s.roll)}" aria-label="Attendance status for ${escapeHtml(s.name)}">
        <option value="" ${status === "" ? "selected" : ""}>Not marked</option>
        <option value="Present" ${status === "Present" ? "selected" : ""}>Present</option>
        <option value="Absent" ${status === "Absent" ? "selected" : ""}>Absent</option>
      </select></td>
      <td class="percent">${getPercentage(s.roll)}%</td>
      <td><button class="remove-btn" data-remove="${escapeHtml(s.roll)}" type="button">Remove</button></td>
    </tr>`;
  }).join("");
  $("studentTable").querySelectorAll(".status-select").forEach(select => {
    select.addEventListener("change", event => {
      attendanceDraft[event.target.dataset.roll] = event.target.value;
      render();
    });
  });
  $("studentTable").querySelectorAll("[data-remove]").forEach(button => {
    button.addEventListener("click", () => removeStudent(button.dataset.remove));
  });
}

$("studentForm").addEventListener("submit", event => {
  event.preventDefault();
  const name = $("studentName").value.trim();
  const roll = $("rollNumber").value.trim();
  if (!name || !roll) return;
  if (state.students.some(s => s.roll.toLowerCase() === roll.toLowerCase())) {
    $("formMessage").textContent = "That roll number already exists. Please use a unique roll number.";
    $("formMessage").style.color = "#b42318";
    return;
  }
  state.students.push({ name, roll });
  state.students.sort((a, b) => a.roll.localeCompare(b.roll, undefined, { numeric: true }));
  persist();
  $("studentName").value = "";
  $("rollNumber").value = "";
  $("formMessage").textContent = `${name} was added successfully.`;
  $("formMessage").style.color = "#28734d";
  render();
});
function removeStudent(roll) {
  const student = state.students.find(s => s.roll === roll);
  if (!student || !confirm(`Remove ${student.name} and their attendance records?`)) return;
  state.students = state.students.filter(s => s.roll !== roll);
  for (const day of Object.values(state.attendance)) delete day[roll];
  delete attendanceDraft[roll];
  persist();
  render();
}
$("attendanceDate").addEventListener("change", () => {
  attendanceDraft = {};
  $("attendanceMessage").textContent = "";
  render();
});
$("searchInput").addEventListener("input", render);
$("markAllPresent").addEventListener("click", () => {
  state.students.forEach(s => { attendanceDraft[s.roll] = "Present"; });
  render();
});
$("saveAttendance").addEventListener("click", () => {
  const date = $("attendanceDate").value;
  if (!date) { $("attendanceMessage").textContent = "Please choose a date."; return; }
  state.attendance[date] = { ...dateRecords(date), ...attendanceDraft };
  for (const roll of Object.keys(state.attendance[date])) {
    if (state.attendance[date][roll] === "") delete state.attendance[date][roll];
  }
  attendanceDraft = {};
  persist();
  $("attendanceMessage").textContent = `Attendance saved for ${date}.`;
  render();
});
$("exportCsv").addEventListener("click", () => {
  const rows = [["Date", "Roll Number", "Student Name", "Status", "Attendance Percentage"]];
  for (const date of Object.keys(state.attendance).sort()) {
    for (const student of state.students) {
      const status = state.attendance[date][student.roll];
      if (status) rows.push([date, student.roll, student.name, status, `${getPercentage(student.roll)}%`]);
    }
  }
  const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "student-attendance.csv"; link.click();
  URL.revokeObjectURL(url);
});
$("clearData").addEventListener("click", () => {
  if (!confirm("This will permanently clear all students and attendance saved in this browser. Continue?")) return;
  state = { students: [], attendance: {} };
  attendanceDraft = {};
  persist();
  $("formMessage").textContent = "";
  $("attendanceMessage").textContent = "All project data was cleared.";
  render();
});
render();

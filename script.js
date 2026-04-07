/**
 * VERSION: 11.0 (Ultimate Integration)
 * TAGS: #NAVIGATION, #ATTENDANCE, #EXAM, #SURVEY
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

let globalExamData = null;
let globalSurveyData = null;
let currentSurveyType = '';
let selectedSpeakerId = null;
let examCountdown = null;
let isExamActive = false;

// [COMMENT: #NAVIGATION - ระบบนำทางและยืนยันตัวตน]
document.addEventListener("DOMContentLoaded", () => {
  let savedId = localStorage.getItem("tms_personal_id");
  if (savedId) { document.getElementById("personalId").value = savedId; showDashboard(); }
});

function login() {
  let id = document.getElementById("personalId").value.trim().toUpperCase();
  if (!id) { Swal.fire('แจ้งเตือน', 'กรุณากรอกรหัสประจำตัวก่อนครับ', 'warning'); return; }
  localStorage.setItem("tms_personal_id", id);
  showDashboard();
  Swal.fire({ icon: 'success', title: 'ยินดีต้อนรับ', text: 'รหัส: ' + id, timer: 1500, showConfirmButton: false });
}

function logout() {
  localStorage.removeItem("tms_personal_id");
  location.reload();
}

function showDashboard() {
  document.getElementById("loginSection").classList.add("d-none");
  document.getElementById("dashboardSection").classList.remove("d-none");
}

function backToDashboard(currentSectionId) {
  document.getElementById(currentSectionId).classList.add("d-none");
  document.getElementById("dashboardSection").classList.remove("d-none");
  isExamActive = false;
  clearInterval(examCountdown);
}

// [COMMENT: #ATTENDANCE - ระบบลงเวลาอัจฉริยะ โชว์ประวัติเวลา]
async function openAttendanceForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("attendanceSection").classList.remove("d-none");
  let container = document.getElementById("attendanceButtonsContainer");
  container.innerHTML = '<div class="text-center my-4"><div class="spinner-border text-info"></div><p class="mt-2 text-muted">ตรวจสอบรอบเวลา...</p></div>';

  try {
    let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getAttendanceData', payload: { personal_id: localStorage.getItem("tms_personal_id") } }) });
    let result = await res.json();
    if (result.status === 'success') {
      container.innerHTML = '';
      if (result.schedule.length === 0) { container.innerHTML = '<div class="alert alert-warning text-center">ไม่มีรอบลงเวลาในขณะนี้</div>'; return; }
      
      result.schedule.forEach(slot => {
        let logKey = slot.day_no + '_' + slot.slot_id;
        let loggedTime = result.userLogs[logKey];
        
        if (loggedTime) {
          // ถ้าลงแล้ว โชว์เป็นปุ่มเทาพร้อมเวลา
          container.innerHTML += `
            <div class="card mb-3 p-3 bg-light border-0 rounded-4 text-center opacity-75 shadow-sm">
              <div class="fw-bold text-secondary">✔️ ${slot.slot_label} บันทึกสำเร็จ</div>
              <small class="text-muted">บันทึกเมื่อ: ${loggedTime}</small>
            </div>`;
        } else {
          // ถ้ายังไม่ลง โชว์ปุ่มเขียวปกติ
          container.innerHTML += `<button class="btn btn-success w-100 mb-3 py-3 fw-bold rounded-4 shadow-sm" onclick="submitRealAttendance('${slot.day_no}', '${slot.slot_id}', 'ตรงเวลา')">📌 ลงเวลา: ${slot.slot_label}<br><small class="fw-normal opacity-75">วันที่ ${slot.day_no} | ${slot.start_time} - ${slot.end_time}</small></button>`;
        }
      });
    }
  } catch (error) { container.innerHTML = '<div class="alert alert-danger">ขาดการเชื่อมต่อกับเซิร์ฟเวอร์</div>'; }
}

async function submitRealAttendance(dayNo, timeSlot, timeStatus) {
  const swalResult = await Swal.fire({ title: 'หมายเหตุการลงเวลา', input: 'text', inputPlaceholder: 'ระบุหมายเหตุ (ถ้ามี)', showCancelButton: true, confirmButtonText: 'บันทึกเวลา' });
  if (!swalResult.isConfirmed) return; 

  Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  let payloadData = { log_id: 'ATT-' + Date.now(), personal_id: localStorage.getItem("tms_personal_id"), day_no: dayNo, time_slot: timeSlot, note: `[${timeStatus}] ${swalResult.value || ""}` };

  try {
    let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitAttendance', payload: payloadData }) });
    let result = await res.json();
    if (result.status === 'success') { Swal.fire('สำเร็จ!', 'บันทึกเวลาเรียบร้อยแล้ว', 'success').then(() => openAttendanceForm()); }
  } catch (error) { Swal.fire('ผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error'); }
}

// [COMMENT: #EXAM - ระบบสอบ พร้อมกันทุจริตและ Auto-Save]
document.addEventListener('visibilitychange', () => {
  if (isExamActive && document.visibilityState === 'hidden') {
    Swal.fire({ icon: 'warning', title: 'คำเตือน: ห้ามสลับหน้าจอ!', text: 'ระบบตรวจพบการออกจากหน้าทำข้อสอบ', confirmButtonColor: '#d33' });
  }
});

async function openExamForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("examSection").classList.remove("d-none");
  let contentArea = document.getElementById("examContentArea");
  contentArea.innerHTML = '<div class="text-center my-5"><div class="spinner-border text-warning"></div><p class="mt-2 text-muted">กำลังดึงข้อสอบ...</p></div>';
  document.getElementById("btnSubmitExam").classList.add("d-none");
  document.getElementById("examTimerBadge").classList.add("d-none");

  try {
    let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getExamData', payload: { personal_id: localStorage.getItem("tms_personal_id") } }) });
    let result = await res.json();
    if (result.status === 'success') { 
      globalExamData = result; 
      document.getElementById("examTitleLabel").innerText = result.activeExam.type + " TEST";
      renderExamStartScreen(); 
    } 
    else if (result.status === 'taken') { contentArea.innerHTML = `<div class="alert alert-success text-center rounded-4"><h5>${result.message}</h5></div>`; }
    else { contentArea.innerHTML = `<div class="alert alert-warning text-center rounded-4">${result.message}</div>`; }
  } catch (error) { contentArea.innerHTML = '<div class="alert alert-danger">ขาดการเชื่อมต่อ</div>'; }
}

function renderExamStartScreen() {
  let contentArea = document.getElementById("examContentArea");
  let exam = globalExamData.activeExam;
  let qCount = globalExamData.questions.length;
  document.getElementById("examTitleLabel").innerText = exam.type + " TEST";

  let retakeMessage = ''; let btnLabel = 'เริ่มทำข้อสอบ'; let btnColor = 'btn-success';

  if (exam.isRetake) {
    let percent = ((exam.previousScore / exam.fullScore) * 100).toFixed(2);
    retakeMessage = `<div class="alert alert-warning mb-3 text-start"><b class="text-danger">⚠️ คุณสอบไม่ผ่านในครั้งแรก</b><br>คะแนนครั้งที่ 1: <b>${exam.previousScore}/${exam.fullScore}</b> (${percent}%)<br>เกณฑ์ผ่านคือ: <b>${exam.passingPercent}%</b><br><i class="text-dark">คุณมีสิทธิ์สอบแก้ตัว (รอบที่ 2) ได้อีก 1 ครั้ง</i></div>`;
    btnLabel = 'เริ่มสอบซ่อม (ครั้งที่ 2)'; btnColor = 'btn-warning text-dark';
  }

  contentArea.innerHTML = `
    <div class="text-center my-5 p-4 bg-light rounded-4 border shadow-sm">
      <h4 class="text-primary fw-bold mb-3">คุณพร้อมหรือไม่?</h4>${retakeMessage}
      <p class="text-muted fs-5">แบบทดสอบนี้มีทั้งหมด <b class="text-dark">${qCount}</b> ข้อ (ข้อละ 2 คะแนน)</p>
      <div class="alert alert-info text-start small mx-auto" style="max-width: 450px;">
        <ul class="mb-0"><li>⏱️ ระบบเริ่มจับเวลาทันทีที่กดปุ่ม</li><li>💾 มีระบบ Auto-Save กันเน็ตหลุด</li><li>🚫 ห้ามสลับแท็บหรือสลับหน้าจอ</li></ul>
      </div>
      <button class="btn btn-lg ${btnColor} mt-3 fw-bold px-5 rounded-pill shadow-sm" onclick="startExamTimer()">${btnLabel}</button>
    </div>
  `;
}

function startExamTimer() {
  isExamActive = true; renderQuestions(); startTimer(30 * 60);
  document.getElementById("btnSubmitExam").classList.remove("d-none");
  document.getElementById("examTimerBadge").classList.remove("d-none");
}

function renderQuestions() {
  let html = ''; const labels = ['ก.', 'ข.', 'ค.', 'ง.'];
  globalExamData.questions.forEach((q, i) => {
    html += `<div class="mb-4 p-4 border rounded-4 bg-white shadow-sm"><p class="fw-bold fs-5">${i + 1}. ${q.question}</p>`;
    ['A','B','C','D'].forEach((opt, idx) => {
      html += `<div class="form-check mb-2"><input class="form-check-input" type="radio" name="q_${q.id}" value="${opt}" id="q_${q.id}_${opt}"><label class="form-check-label w-100" for="q_${q.id}_${opt}"><b class="text-primary">${labels[idx]}</b> ${globalExamData.questions[i].options[opt]}</label></div>`;
    });
    html += `</div>`;
  });
  document.getElementById("examContentArea").innerHTML = html;
}

function startTimer(sec) {
  examCountdown = setInterval(() => {
    let m = Math.floor(sec / 60), s = sec % 60;
    document.getElementById("examTimeDisplay").innerText = `${m}:${s < 10 ? '0'+s : s}`;
    if (--sec < 0) { clearInterval(examCountdown); submitRealExam(); }
  }, 1000);
}

async function submitRealExam() {
  isExamActive = false; clearInterval(examCountdown);
  let score = 0;
  globalExamData.questions.forEach(q => {
    let sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
    if (sel && sel.value === q.answer) score += 2;
  });
  Swal.fire({ title: 'กำลังบันทึกคะแนน...', didOpen: () => Swal.showLoading() });
  await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitExam', payload: { personal_id: localStorage.getItem("tms_personal_id"), test_type: globalExamData.activeExam.type, score: score, max_score: globalExamData.questions.length * 2 } }) });
  Swal.fire('สำเร็จ', `คะแนนของคุณคือ ${score}`, 'success').then(() => backToDashboard('examSection'));
}

// [COMMENT: #SURVEY - ระบบประเมินผล ดึงวิทยากรตามเวลา Active]
async function openSurveyForm(type) {
  currentSurveyType = type; selectedSpeakerId = null;
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("surveySection").classList.remove("d-none");
  let contentArea = document.getElementById("surveyContentArea");
  let speakerArea = document.getElementById("speakerSelectionArea");
  document.getElementById("surveyTitleLabel").innerText = type === 'PROJECT_SURVEY' ? 'ประเมินภาพรวมโครงการ' : 'ประเมินวิทยากร';
  contentArea.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-success"></div></div>';
  document.getElementById("btnSubmitSurvey").classList.add("d-none");

  try {
    let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getSurveyData', payload: { survey_type: type } }) });
    globalSurveyData = await res.json();
    if (type === 'SPEAKER_SURVEY') { renderSpeakerGrid(); contentArea.innerHTML = '<p class="text-center text-muted p-5">โปรดเลือกวิทยากรด้านบนเพื่อเริ่มทำแบบประเมิน</p>'; }
    else { speakerArea.classList.add("d-none"); renderSurveyQuestions(); document.getElementById("btnSubmitSurvey").classList.remove("d-none"); }
  } catch (e) { contentArea.innerHTML = 'ผิดพลาดในการโหลดข้อมูล'; }
}

function renderSpeakerGrid() {
  let grid = document.getElementById("speakerButtonsGrid"); grid.innerHTML = '';
  if (!globalSurveyData.speakers || globalSurveyData.speakers.length === 0) {
    document.getElementById("surveyContentArea").innerHTML = '<div class="alert alert-warning text-center">ไม่มีวิทยากรเปิดประเมินในขณะนี้</div>';
    return;
  }
  globalSurveyData.speakers.forEach(spk => {
    grid.innerHTML += `<div class="col-12 col-md-6"><div class="card p-3 shadow-sm rounded-4 spk-card h-100 text-center" id="card_spk_${spk.id}" onclick="selectSpeaker('${spk.id}')"><h6 class="fw-bold text-primary mb-1">${spk.name}</h6><small class="text-muted">${spk.topic}</small></div></div>`;
  });
  document.getElementById("speakerSelectionArea").classList.remove("d-none");
}

function selectSpeaker(id) {
  selectedSpeakerId = id;
  document.querySelectorAll('.spk-card').forEach(c => c.classList.remove('active'));
  document.getElementById(`card_spk_${id}`).classList.add('active');
  renderSurveyQuestions();
  document.getElementById("btnSubmitSurvey").classList.remove("d-none");
  document.getElementById("surveyContentArea").scrollIntoView({ behavior: 'smooth' });
}

function renderSurveyQuestions() {
  let html = ''; let grouped = {};
  globalSurveyData.questions.forEach(q => { if(!grouped[q.category]) grouped[q.category] = []; grouped[q.category].push(q); });
  Object.keys(grouped).forEach(cat => {
    html += `<h6 class="fw-bold text-primary mt-4 mb-3 border-bottom pb-2">${cat}</h6>`;
    grouped[cat].forEach(q => {
      let opts = '';
      q.options.forEach(opt => { opts += `<div class="form-check mb-2 ms-2"><input class="form-check-input" type="radio" name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}"><label class="form-check-label w-100" for="sq_${q.id}_${opt}" style="cursor:pointer;">${opt}</label></div>`; });
      html += `<div class="card p-4 mb-3 border-0 shadow-sm rounded-4 border-start border-4 border-info"><p class="fw-bold mb-3 fs-5">${q.question}</p>${opts}</div>`;
    });
  });
  document.getElementById("surveyContentArea").innerHTML = html;
}

async function submitRealSurvey() {
  let answers = {}; let complete = true;
  globalSurveyData.questions.forEach(q => {
    let sel = document.querySelector(`input[name="sq_${q.id}"]:checked`);
    if(sel) answers[q.id] = sel.value; else complete = false;
  });
  if(!complete) { Swal.fire('เตือน', 'กรุณาตอบให้ครบทุกข้อ', 'warning'); return; }
  Swal.fire({ title: 'กำลังบันทึก...', didOpen: () => Swal.showLoading() });
  let payload = { personal_id: localStorage.getItem("tms_personal_id"), answers: answers };
  if(currentSurveyType === 'SPEAKER_SURVEY') payload.target_id = selectedSpeakerId;
  await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: currentSurveyType === 'PROJECT_SURVEY' ? 'submitProjectEval' : 'submitSpeakerEval', payload: payload }) });
  Swal.fire('สำเร็จ', 'บันทึกข้อมูลเรียบร้อย', 'success').then(() => backToDashboard('surveySection'));
}
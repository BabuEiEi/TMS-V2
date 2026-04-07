/**
 * PROJECT: TMS-V2
 * VERSION: 13.0 (Master Edition)
 * FEATURES: Time History, Cheat Protection, Ready Screen, Speaker Select
 * TAGS FOR SEARCH: #NAV_LOGIC, #ATT_LOGIC, #EXAM_LOGIC, #SURVEY_LOGIC
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

let globalExamData = null;
let globalSurveyData = null;
let currentSurveyType = '';
let selectedSpeakerId = null;
let examCountdown = null;
let isExamActive = false;

// ==========================================
// [#NAV_LOGIC]: ระบบนำทางและการจัดการสถานะ
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  let savedId = localStorage.getItem("tms_personal_id");
  if (savedId) {
    document.getElementById("personalId").value = savedId;
    showDashboard();
  }
});

function login() {
  let id = document.getElementById("personalId").value.trim().toUpperCase();
  if (id === "") {
    Swal.fire('แจ้งเตือน', 'กรุณากรอกรหัสประจำตัวก่อนครับ', 'warning');
    return;
  }
  localStorage.setItem("tms_personal_id", id);
  showDashboard();
  Swal.fire({ icon: 'success', title: 'ยินดีต้อนรับ', text: 'รหัส: ' + id, timer: 1500, showConfirmButton: false });
}

function logout() {
  localStorage.removeItem("tms_personal_id");
  location.reload(); // รีโหลดเพื่อล้าง State ทั้งหมด
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


// ==========================================
// [#ATT_LOGIC]: ระบบลงเวลาพร้อมแสดงประวัติ
// ==========================================

async function openAttendanceForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("attendanceSection").classList.remove("d-none");
  
  let userId = localStorage.getItem("tms_personal_id");
  let btnContainer = document.getElementById("attendanceButtonsContainer");
  
  btnContainer.innerHTML = '<div class="text-center my-4"><div class="spinner-border text-info"></div><p class="mt-2 text-muted">กำลังตรวจสอบสถานะการลงเวลา...</p></div>';

  try {
    let response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getAttendanceData', payload: { personal_id: userId } })
    });
    let result = await response.json();

    if (result.status === 'success') {
      renderAttendanceButtons(result.schedule, result.userLogs);
    } else {
      btnContainer.innerHTML = `<div class="alert alert-danger rounded-4">${result.message}</div>`;
    }
  } catch (error) {
    btnContainer.innerHTML = '<div class="alert alert-danger rounded-4">ขาดการเชื่อมต่อกับเซิร์ฟเวอร์</div>';
  }
}

function renderAttendanceButtons(schedule, userLogs) {
  let btnContainer = document.getElementById("attendanceButtonsContainer");
  btnContainer.innerHTML = ''; 
  
  if (schedule.length === 0) {
    btnContainer.innerHTML = '<div class="alert alert-warning text-center rounded-4 shadow-sm">ขณะนี้ไม่มีรอบการลงเวลาที่เปิดใช้งาน</div>';
    return;
  }

  schedule.forEach(slot => {
    let key = slot.day_no + '_' + slot.slot_id;
    let loggedTime = userLogs[key];
    let btnHtml = '';

    if (loggedTime) {
      // 🟢 กรณีลงเวลาเรียบร้อยแล้ว: โชว์ปุ่มสีเทาพร้อมประวัติเวลา
      btnHtml = `
        <div class="card mb-3 p-3 bg-light border-0 rounded-4 text-center opacity-75 shadow-sm">
          <div class="fw-bold text-secondary">✔️ ลงเวลา${slot.slot_label}แล้ว</div>
          <small class="text-muted">บันทึกเมื่อ: ${loggedTime}</small>
        </div>`;
    } else {
      // 🔴 กรณีรอบที่ยังไม่ได้ลง
      btnHtml = `
        <button class="btn btn-success w-100 mb-3 py-3 fw-bold rounded-4 shadow-sm" 
                onclick="submitRealAttendance('${slot.day_no}', '${slot.slot_id}', 'ตรงเวลา')">
          📌 ลงเวลา: ${slot.slot_label}<br>
          <small class="fw-normal opacity-75">วันที่ ${slot.day_no} | ${slot.start_time} - ${slot.end_time}</small>
        </button>`;
    }
    btnContainer.innerHTML += btnHtml;
  });
}

async function submitRealAttendance(dayNo, timeSlot, timeStatus) {
  const swalResult = await Swal.fire({
    title: 'ยืนยันการบันทึกเวลา',
    text: 'คุณต้องการบันทึกเวลาเข้าร่วมอบรมใช่หรือไม่?',
    icon: 'question',
    input: 'text',
    inputPlaceholder: 'ระบุหมายเหตุ (ถ้ามี)',
    showCancelButton: true,
    confirmButtonText: 'ใช่, บันทึกเวลา',
    confirmButtonColor: '#0dcaf0'
  });

  if (!swalResult.isConfirmed) return; 

  Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

  let payloadData = {
    personal_id: localStorage.getItem("tms_personal_id"),
    day_no: dayNo,
    time_slot: timeSlot,
    note: `[${timeStatus}] ${swalResult.value || ""}`
  };

  try {
    let response = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitAttendance', payload: payloadData }) });
    let result = await response.json();
    if (result.status === 'success') {
      Swal.fire('สำเร็จ!', 'บันทึกเวลาของคุณเรียบร้อยแล้วครับ', 'success').then(() => { openAttendanceForm(); });
    }
  } catch (error) {
    Swal.fire('ผิดพลาด', 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้', 'error');
  }
}


// ==========================================
// [#EXAM_LOGIC]: ระบบข้อสอบและหน้า Welcome
// ==========================================

document.addEventListener('visibilitychange', () => {
  if (isExamActive && document.visibilityState === 'hidden') {
    Swal.fire({
      icon: 'warning',
      title: 'คำเตือน: ห้ามสลับหน้าจอ!',
      text: 'ระบบได้บันทึกพฤติกรรมนี้ไว้แล้ว กรุณากลับมาทำข้อสอบให้เสร็จสิ้นครับ',
      confirmButtonColor: '#d33'
    });
  }
});

async function openExamForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("examSection").classList.remove("d-none");
  
  let userId = localStorage.getItem("tms_personal_id");
  let contentArea = document.getElementById("examContentArea");
  
  contentArea.innerHTML = '<div class="text-center my-5"><div class="spinner-border text-warning"></div><p class="mt-2 text-muted">กำลังดึงชุดข้อสอบล่าสุด...</p></div>';
  document.getElementById("btnSubmitExam").classList.add("d-none");
  document.getElementById("examTimerBadge").classList.add("d-none");

  try {
    let response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'getExamData', payload: { personal_id: userId } })
    });
    let result = await response.json();

    if (result.status === 'success') {
      globalExamData = result;
      document.getElementById("examTitleLabel").innerText = result.activeExam.type + " TEST";
      renderExamStartScreen(); // 🟢 แสดงหน้าจอ "คุณพร้อมหรือไม่" ก่อน
    } else if (result.status === 'taken') {
      contentArea.innerHTML = `<div class="alert alert-success text-center rounded-4 p-5"><h5>${result.message}</h5><p class="mb-0">คุณได้ทำการส่งคำตอบเข้าระบบเรียบร้อยแล้ว</p></div>`;
    } else {
      contentArea.innerHTML = `<div class="alert alert-warning text-center rounded-4 p-5">${result.message}</div>`;
    }
  } catch (error) {
    contentArea.innerHTML = '<div class="alert alert-danger text-center rounded-4">ขาดการเชื่อมต่อ</div>';
  }
}

function renderExamStartScreen() {
  let contentArea = document.getElementById("examContentArea");
  let exam = globalExamData.activeExam;
  let qCount = globalExamData.questions.length;
  
  let retakeMessage = '';
  let btnLabel = 'เริ่มทำข้อสอบ';
  let btnColor = 'btn-success';

  if (globalExamData.attempts > 0 && exam.type === 'POST') {
    retakeMessage = `<div class="alert alert-warning mb-3">⚠️ คุณเคยทำแบบทดสอบนี้แล้ว ระบบให้สิทธิ์สอบซ่อม (ครั้งที่ 2) ได้อีกหนึ่งครั้งครับ</div>`;
    btnLabel = 'เริ่มสอบซ่อม (ครั้งที่ 2)';
    btnColor = 'btn-warning text-dark';
  }

  contentArea.innerHTML = `
    <div class="text-center my-5 p-4 bg-light rounded-4 border shadow-sm">
      <h4 class="text-primary fw-bold mb-3">คุณพร้อมหรือไม่?</h4>
      ${retakeMessage}
      <p class="text-muted fs-5">แบบทดสอบนี้มีทั้งหมด <b class="text-dark">${qCount}</b> ข้อ (ข้อละ 2 คะแนน)</p>
      <div class="alert alert-info text-start small mx-auto" style="max-width: 450px;">
        <ul class="mb-0">
          <li>⏱️ ระบบจะเริ่มจับเวลาทันทีที่กดปุ่มเริ่ม</li>
          <li>💾 มีระบบ Auto-Save กันเน็ตหลุด</li>
          <li>🚫 ห้ามสลับแท็บหรือสลับหน้าจอ ระบบจะแจ้งเตือน</li>
        </ul>
      </div>
      <button class="btn btn-lg ${btnColor} mt-3 fw-bold px-5 rounded-pill shadow-sm" onclick="startExamTimer()">${btnLabel}</button>
    </div>
  `;
}

function startExamTimer() {
  isExamActive = true; 
  renderQuestions(); 
  startTimer(30 * 60); // เริ่มนับเวลา 30 นาที
  document.getElementById("btnSubmitExam").classList.remove("d-none");
  document.getElementById("examTimerBadge").classList.remove("d-none");
}

function renderQuestions() {
  let html = '';
  const labels = ['ก.', 'ข.', 'ค.', 'ง.'];
  
  // สลับข้อสอบเพื่อความยุติธรรม
  globalExamData.questions.sort(() => Math.random() - 0.5);

  globalExamData.questions.forEach((q, i) => {
    html += `
      <div class="card mb-4 p-4 border rounded-4 bg-white shadow-sm">
        <p class="fw-bold fs-5 mb-3">${i + 1}. ${q.question}</p>`;
    
    ['A','B','C','D'].forEach((opt, idx) => {
      html += `
        <div class="form-check mb-2">
          <input class="form-check-input border-secondary" type="radio" 
                 name="q_${q.id}" value="${opt}" id="q_${q.id}_${opt}" 
                 onchange="saveDraftAnswer('${q.id}','${opt}')">
          <label class="form-check-label w-100" for="q_${q.id}_${opt}" style="cursor:pointer;">
            <b class="text-primary">${labels[idx]}</b> ${globalExamData.questions[i].options[opt]}
          </label>
        </div>`;
    });
    
    html += `</div>`;
  });
  document.getElementById("examContentArea").innerHTML = html;
}

function saveDraftAnswer(qId, val) { 
  let userId = localStorage.getItem("tms_personal_id");
  let testType = globalExamData.activeExam.type;
  let draft = JSON.parse(localStorage.getItem(`tms_draft_${userId}_${testType}`) || "{}");
  draft[qId] = val;
  localStorage.setItem(`tms_draft_${userId}_${testType}`, JSON.stringify(draft));
}

function startTimer(sec) {
  let display = document.getElementById("examTimeDisplay");
  examCountdown = setInterval(() => {
    let m = Math.floor(sec / 60);
    let s = sec % 60;
    display.innerText = `${m}:${s < 10 ? '0'+s : s}`;
    
    if (sec === 300) { 
      Swal.fire({ toast: true, position: 'top', icon: 'warning', title: 'เหลือเวลา 5 นาทีสุดท้าย!', showConfirmButton: false, timer: 5000 }); 
    }
    
    if (--sec < 0) { 
      clearInterval(examCountdown); 
      Swal.fire('หมดเวลา!', 'ระบบกำลังส่งคำตอบให้อัตโนมัติครับ', 'warning').then(() => submitRealExam()); 
    }
  }, 1000);
}

async function submitRealExam() {
  const confirm = await Swal.fire({ title: 'ยืนยันการส่งคำตอบ?', icon: 'question', showCancelButton: true, confirmButtonText: 'ส่งคำตอบ' });
  if (!confirm.isConfirmed) return;

  isExamActive = false; 
  clearInterval(examCountdown);
  
  let score = 0;
  globalExamData.questions.forEach(q => {
    let sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
    if (sel && sel.value === q.answer) score += 2;
  });

  Swal.fire({ title: 'กำลังประมวลผลคะแนน...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });

  let payload = {
    personal_id: localStorage.getItem("tms_personal_id"),
    test_type: globalExamData.activeExam.type,
    score: score,
    max_score: globalExamData.questions.length * 2
  };

  try {
    await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitExam', payload: payload }) });
    localStorage.removeItem(`tms_draft_${payload.personal_id}_${payload.test_type}`);
    Swal.fire('เรียบร้อย', `การทดสอบเสร็จสิ้น คะแนนของคุณคือ ${score}`, 'success').then(() => backToDashboard('examSection'));
  } catch (e) {
    Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกคะแนนได้ กรุณาแคปหน้าจอแจ้งเจ้าหน้าที่ครับ', 'error');
  }
}


// ==========================================
// [#SURVEY_LOGIC]: ระบบประเมินวิทยากรและโครงการ
// ==========================================

async function openSurveyForm(type) {
  currentSurveyType = type;
  selectedSpeakerId = null;
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("surveySection").classList.remove("d-none");
  
  let contentArea = document.getElementById("surveyContentArea");
  document.getElementById("surveyTitleLabel").innerText = type === 'PROJECT_SURVEY' ? 'ประเมินภาพรวมโครงการ' : 'ประเมินวิทยากร';
  contentArea.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-success"></div><p class="mt-2 text-muted">กำลังเตรียมแบบประเมิน...</p></div>';
  document.getElementById("btnSubmitSurvey").classList.add("d-none");

  try {
    let response = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'getSurveyData', payload: { survey_type: type } }) });
    globalSurveyData = await response.json();
    
    if (type === 'SPEAKER_SURVEY') { 
        renderSpeakerSelect(); 
        contentArea.innerHTML = '<p class="text-center text-muted p-5 bg-white rounded-4 border">โปรดเลือกวิทยากรที่ช่องด้านบนเพื่อแสดงแบบสอบถาม</p>';
    } else { 
        document.getElementById("speakerSelectionArea").classList.add("d-none");
        renderSurveyQuestions(); 
        document.getElementById("btnSubmitSurvey").classList.remove("d-none"); 
    }
  } catch (e) {
    contentArea.innerHTML = '<div class="alert alert-danger">ผิดพลาดในการโหลดข้อมูล</div>';
  }
}

function renderSpeakerSelect() {
  let select = document.getElementById("speakerSelect");
  select.innerHTML = '<option value="" disabled selected>-- คลิกเพื่อเลือกวิทยากร --</option>';
  
  if (!globalSurveyData.speakers || globalSurveyData.speakers.length === 0) {
    document.getElementById("surveyContentArea").innerHTML = '<div class="alert alert-warning text-center rounded-4">ขณะนี้ไม่มีรอบวิทยากรที่เปิดประเมินตามวันเวลาปัจจุบันครับ</div>';
    return;
  }
  
  globalSurveyData.speakers.forEach(spk => {
    select.innerHTML += `<option value="${spk.id}">${spk.name} (หัวข้อ: ${spk.topic})</option>`;
  });
  
  document.getElementById("speakerSelectionArea").classList.remove("d-none");
  select.onchange = () => { renderSurveyQuestions(); document.getElementById("btnSubmitSurvey").classList.remove("d-none"); };
}

function renderSurveyQuestions() {
  let html = '';
  let grouped = {};
  globalSurveyData.questions.forEach(q => {
    if(!grouped[q.category]) grouped[q.category] = [];
    grouped[q.category].push(q);
  });

  Object.keys(grouped).forEach(cat => {
    html += `<h6 class="fw-bold text-primary mt-4 mb-3 border-bottom pb-2 border-3">${cat}</h6>`;
    grouped[cat].forEach(q => {
      let optsHtml = '';
      if (q.options[0] === 'TEXT') {
        optsHtml = `<textarea class="form-control shadow-sm" name="sq_${q.id}" rows="3" placeholder="ระบุความคิดเห็นของคุณ..."></textarea>`;
      } else {
        q.options.forEach(opt => { 
          optsHtml += `<div class="form-check mb-2 ms-2"><input class="form-check-input border-secondary" type="radio" name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}"><label class="form-check-label w-100" for="sq_${q.id}_${opt}" style="cursor:pointer;">${opt}</label></div>`; 
        });
      }
      html += `<div class="card p-4 mb-3 border-0 shadow-sm rounded-4 border-start border-4 border-info"><p class="fw-bold mb-3 fs-5 text-dark">${q.question}</p>${optsHtml}</div>`;
    });
  });
  document.getElementById("surveyContentArea").innerHTML = html;
}

async function submitRealSurvey() {
  let answers = {};
  let complete = true;
  
  globalSurveyData.questions.forEach(q => {
    let sel = document.querySelector(`input[name="sq_${q.id}"]:checked`) || document.querySelector(`textarea[name="sq_${q.id}"]`);
    if(sel && sel.value !== "") answers[q.id] = sel.value; else complete = false;
  });

  if(!complete) { Swal.fire('คำแนะนำ', 'กรุณาตอบแบบประเมินให้ครบทุกข้อก่อนส่งข้อมูลครับ', 'warning'); return; }
  
  let target = currentSurveyType === 'PROJECT_SURVEY' ? 'PROJECT' : document.getElementById("speakerSelect").value;
  let payload = { personal_id: localStorage.getItem("tms_personal_id"), answers: answers, target_id: target };
  
  Swal.fire({ title: 'กำลังบันทึกผลประเมิน...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
  
  try {
    let action = currentSurveyType === 'PROJECT_SURVEY' ? 'submitProjectEval' : 'submitSpeakerEval';
    let res = await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: action, payload: payload }) });
    let result = await res.json();
    if(result.status === 'success') {
      Swal.fire('สำเร็จ', 'ขอบคุณสำหรับข้อมูลประเมินที่มีคุณค่าครับ', 'success').then(() => backToDashboard('surveySection'));
    }
  } catch (e) {
    Swal.fire('ผิดพลาด', 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error');
  }
}
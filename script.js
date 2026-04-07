/**
 * PROJECT: TMS-V2
 * VERSION: 21.0 (The Correct Structure Edition)
 * AUTHOR: วิ (AI Assistant)
 * DESCRIPTION: ไฟล์ Logic ที่แก้ไขการแสดงผล Bullet ตอนที่ 1 และ 2 ตามสั่ง
 * [COMMENT: TAGS: #NAV_LOGIC, #ATT_LOGIC, #EXAM_LOGIC, #SURVEY_LOGIC]
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbzsKRuMkwiBflXOpO9Reh_PJM9JiZG1PIKSddDnbemp8zamumYpAAX-dec5lNtRdchMyg/exec';

let globalExamData = null;
let globalSurveyData = null;
let currentSurveyType = '';
let selectedSpeakerId = null;
let examCountdown = null;
let isExamActive = false;

// ============================================================
// [#NAV_LOGIC]: การจัดการนำทางและสถานะ
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  let savedId = localStorage.getItem("tms_personal_id");
  
  if (savedId) {
    document.getElementById("personalId").value = savedId;
    showDashboard();
  }
});

function login() {
  let idInput = document.getElementById("personalId");
  let id = idInput.value.trim().toUpperCase();
  
  if (id === "") {
    Swal.fire({
      icon: 'warning',
      title: 'แจ้งเตือน',
      text: 'กรุณากรอกรหัสประจำตัวก่อนครับ'
    });
    return;
  }
  
  localStorage.setItem("tms_personal_id", id);
  showDashboard();
  
  Swal.fire({ 
    icon: 'success', 
    title: 'เข้าสู่ระบบสำเร็จ', 
    timer: 1500, 
    showConfirmButton: false 
  });
}

function logout() {
  localStorage.removeItem("tms_personal_id");
  location.reload();
}

function showDashboard() {
  document.getElementById("loginSection").classList.add("d-none");
  document.getElementById("dashboardSection").classList.remove("d-none");
}

function backToDashboard(currentId) {
  document.getElementById(currentId).classList.add("d-none");
  document.getElementById("dashboardSection").classList.remove("d-none");
  
  isExamActive = false;
  clearInterval(examCountdown);
}


// ============================================================
// [#ATT_LOGIC]: ระบบลงเวลาและประวัติ
// ============================================================

async function openAttendanceForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("attendanceSection").classList.remove("d-none");
  
  let userId = localStorage.getItem("tms_personal_id");
  let btnContainer = document.getElementById("attendanceButtonsContainer");
  
  btnContainer.innerHTML = `
    <div class="text-center my-4">
      <div class="spinner-border text-info"></div>
      <p class="mt-2 text-muted">ตรวจสอบสถานะการลงเวลา...</p>
    </div>`;

  try {
    let response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'getAttendanceData', 
        payload: { personal_id: userId } 
      })
    });
    let result = await response.json();

    if (result.status === 'success') {
      renderAttendanceButtons(result.schedule, result.userLogs);
    }
  } catch (error) {
    btnContainer.innerHTML = '<div class="alert alert-danger text-center">ขาดการเชื่อมต่อ</div>';
  }
}

function renderAttendanceButtons(schedule, userLogs) {
  let btnContainer = document.getElementById("attendanceButtonsContainer");
  btnContainer.innerHTML = ''; 

  schedule.forEach(slot => {
    let key = slot.day_no + '_' + slot.slot_id;
    let loggedTime = userLogs[key];

    if (loggedTime) {
      btnContainer.innerHTML += `
        <div class="card mb-3 p-3 bg-light border-0 rounded-4 text-center shadow-sm">
          <div class="fw-bold text-secondary">✔️ ${slot.slot_label} บันทึกสำเร็จแล้ว</div>
          <small class="text-muted">บันทึกเมื่อ: ${loggedTime}</small>
        </div>`;
    } else {
      btnContainer.innerHTML += `
        <button class="btn btn-success w-100 mb-3 py-3 fw-bold rounded-4 shadow-sm" 
                onclick="submitRealAttendance('${slot.day_no}', '${slot.slot_id}')">
          📌 ลงเวลา: ${slot.slot_label}
        </button>`;
    }
  });
}

async function submitRealAttendance(day, slot) {
  Swal.fire({ 
    title: 'กำลังบันทึกเวลา...', 
    allowOutsideClick: false, 
    didOpen: () => { 
        Swal.showLoading(); 
    } 
  });

  let payload = {
    personal_id: localStorage.getItem("tms_personal_id"),
    day_no: day,
    time_slot: slot,
    note: '[V21]'
  };

  try {
    await fetch(GAS_API_URL, { 
      method: 'POST', 
      body: JSON.stringify({ action: 'submitAttendance', payload: payload }) 
    });
    
    openAttendanceForm();
    Swal.close();
  } catch (e) {
    Swal.fire('ผิดพลาด', 'ไม่สามารถบันทึกได้', 'error');
  }
}


// ============================================================
// [#EXAM_LOGIC]: ระบบข้อสอบและหน้าเตรียมพร้อม
// ============================================================

async function openExamForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("examSection").classList.remove("d-none");
  
  let contentArea = document.getElementById("examContentArea");
  contentArea.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-warning"></div></div>';

  try {
    let response = await fetch(GAS_API_URL, {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'getExamData', 
        payload: { personal_id: localStorage.getItem("tms_personal_id") } 
      })
    });
    let result = await response.json();

    if (result.status === 'success') {
      globalExamData = result;
      document.getElementById("examTitleLabel").innerText = result.activeExam.type + " TEST";
      renderExamStartScreen();
    } else {
      contentArea.innerHTML = `<div class="alert alert-info text-center rounded-4 p-5">${result.message}</div>`;
    }
  } catch (error) {
    contentArea.innerHTML = '<div class="alert alert-danger text-center">โหลดไม่สำเร็จ</div>';
  }
}

function renderExamStartScreen() {
  let qCount = globalExamData.questions.length;
  
  document.getElementById("examContentArea").innerHTML = `
    <div class="text-center my-5 p-4 bg-light rounded-4 border shadow-sm">
      <h4 class="text-primary fw-bold mb-3">คุณพร้อมที่จะทำแบบทดสอบหรือไม่?</h4>
      <p class="text-muted fs-5">จำนวนข้อสอบทั้งหมด <b class="text-dark">${qCount}</b> ข้อ</p>
      <button class="btn btn-lg btn-success mt-3 fw-bold px-5 rounded-pill shadow-sm" 
              onclick="startExamTimer()">
        เริ่มทำแบบทดสอบเดี๋ยวนี้
      </button>
    </div>`;
}

function startExamTimer() {
  isExamActive = true; 
  renderExamQuestions(); 
  startTimer(30 * 60);
  
  document.getElementById("btnSubmitExam").classList.remove("d-none");
  document.getElementById("examTimerBadge").classList.remove("d-none");
}

function renderExamQuestions() {
  let html = '';
  const labels = ['ก.', 'ข.', 'ค.', 'ง.'];
  
  globalExamData.questions.forEach((q, i) => {
    html += `
      <div class="card mb-4 p-4 border rounded-4 bg-white shadow-sm">
        <p class="fw-bold fs-5 mb-3">${i + 1}. ${q.question}</p>`;
    
    ['A','B','C','D'].forEach((opt, idx) => {
      html += `
        <div class="form-check mb-2">
          <input class="form-check-input border-secondary" type="radio" name="q_${q.id}" value="${opt}" id="q_${q.id}_${opt}">
          <label class="form-check-label w-100" for="q_${q.id}_${opt}" style="cursor:pointer;">
            <b class="text-primary">${labels[idx]}</b> ${globalExamData.questions[i].options[opt]}
          </label>
        </div>`;
    });
    
    html += `</div>`;
  });
  document.getElementById("examContentArea").innerHTML = html;
}

function startTimer(sec) {
  let display = document.getElementById("examTimeDisplay");
  
  examCountdown = setInterval(() => {
    let m = Math.floor(sec / 60);
    let s = sec % 60;
    
    display.innerText = (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
    
    if (--sec < 0) { 
      clearInterval(examCountdown); 
      submitRealExam(true);
    }
  }, 1000);
}

async function submitRealExam(isAuto = false) {
  if (!isAuto) {
    const confirm = await Swal.fire({ title: 'ยืนยันการส่งคำตอบ?', icon: 'question', showCancelButton: true });
    if (!confirm.isConfirmed) {
        return;
    }
  }

  isExamActive = false; 
  clearInterval(examCountdown);
  
  let score = 0;
  globalExamData.questions.forEach(q => {
    let sel = document.querySelector(`input[name="q_${q.id}"]:checked`);
    if (sel && sel.value === q.answer) {
        score += 2;
    }
  });

  let payload = {
    personal_id: localStorage.getItem("tms_personal_id"),
    test_type: globalExamData.activeExam.type,
    score: score,
    max_score: globalExamData.questions.length * 2
  };

  try {
    await fetch(GAS_API_URL, { method: 'POST', body: JSON.stringify({ action: 'submitExam', payload: payload }) });
    Swal.fire('สำเร็จ', `คะแนนคือ ${score}`, 'success').then(() => backToDashboard('examSection'));
  } catch (e) {
    Swal.fire('ผิดพลาด', 'ส่งไม่ได้', 'error');
  }
}


// ============================================================
// [#SURVEY_LOGIC]: ระบบประเมิน (FIXED V21.0 - แยก ดิ่ง/นอน)
// ============================================================

async function openSurveyForm(type) {
  currentSurveyType = type;
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("surveySection").classList.remove("d-none");
  
  let contentArea = document.getElementById("surveyContentArea");
  document.getElementById("surveyTitleLabel").innerText = type === 'PROJECT_SURVEY' ? 'ประเมินภาพรวมโครงการ' : 'ประเมินวิทยากร';
  
  contentArea.innerHTML = '<div class="text-center p-5"><div class="spinner-border text-success"></div></div>';
  document.getElementById("btnSubmitSurvey").classList.add("d-none");

  try {
    let response = await fetch(GAS_API_URL, { 
      method: 'POST', 
      body: JSON.stringify({ action: 'getSurveyData', payload: { survey_type: type } }) 
    });
    globalSurveyData = await response.json();
    
    if (type === 'SPEAKER_SURVEY') { 
        renderSpeakerSelect(); 
    } else { 
        document.getElementById("speakerSelectionArea").classList.add("d-none");
        renderSurveyQuestions(); 
        document.getElementById("btnSubmitSurvey").classList.remove("d-none"); 
    }
  } catch (e) {
    contentArea.innerHTML = '<div class="alert alert-danger text-center">โหลดไม่สำเร็จ</div>';
  }
}

function renderSpeakerSelect() {
  let select = document.getElementById("speakerSelect");
  select.innerHTML = '<option value="" disabled selected>-- คลิกเพื่อเลือกวิทยากร --</option>';
  
  globalSurveyData.speakers.forEach(spk => {
    select.innerHTML += `<option value="${spk.id}">${spk.name}</option>`;
  });
  
  document.getElementById("speakerSelectionArea").classList.remove("d-none");
  select.onchange = () => { 
    renderSurveyQuestions(); 
    document.getElementById("btnSubmitSurvey").classList.remove("d-none"); 
  };
}

// [COMMENT: FIXED V21.0 - แยกตอนที่ 1 (แนวดิ่ง) และ ตอนที่ 2 (แนวนอน 5-1)]
function renderSurveyQuestions() {
  let html = '';
  let grouped = {};
  
  globalSurveyData.questions.forEach(q => {
    if(!grouped[q.category]) {
        grouped[q.category] = [];
    }
    grouped[q.category].push(q);
  });

  Object.keys(grouped).forEach(cat => {
    html += `<h4 class="category-title">${cat}</h4>`;
      
    grouped[cat].forEach(q => {
      let optionsHtml = '';
      
      // 🟢 กรณีเป็นตอนที่ 2 (Rating Scale 5-1): แสดงผลเป็น Bullet แนวนอน
      if (cat.includes("ตอนที่ 2")) {
        optionsHtml += `<div class="horizontal-options">`;
        
        // เรียงลำดับจากมากไปน้อย 5 4 3 2 1
        const sortedRatings = [...q.options].sort((a, b) => {
            return b - a;
        });

        sortedRatings.forEach(opt => {
          optionsHtml += `
            <div class="form-check">
              <input class="form-check-input" type="radio" 
                     name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}">
              <label class="form-check-label" for="sq_${q.id}_${opt}">
                ${opt}
              </label>
            </div>`;
        });
        
        optionsHtml += `</div>`;
        optionsHtml += `<div class="mt-2 ms-2"><small class="text-muted">ระดับ 5 คือมากที่สุด และระดับ 1 คือน้อยที่สุด</small></div>`;
      } 
      
      // 🔵 กรณีเป็นตอนที่ 1 (ข้อมูลทั่วไป): แสดงผลเป็น Bullet แนวดิ่ง (มาตรฐาน)
      else if (cat.includes("ตอนที่ 1")) {
        q.options.forEach(opt => {
          optionsHtml += `
            <div class="form-check mb-2 ms-2">
              <input class="form-check-input" type="radio" 
                     name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}">
              <label class="form-check-label w-100" for="sq_${q.id}_${opt}" style="cursor:pointer;">
                ${opt}
              </label>
            </div>`;
        });
      }
      
      // 📝 กรณีเป็นตอนที่ 3 หรืออื่นๆ (TEXT)
      else if (q.options[0] === 'TEXT') {
        optionsHtml = `<textarea class="form-control" name="sq_${q.id}" rows="3" placeholder="ระบุความคิดเห็น..."></textarea>`;
      }

      // วาดการ์ดคำถาม
      html += `
        <div class="question-card fade-in">
          <div class="question-text">${q.question}</div>
          <div class="options-container">
            ${optionsHtml}
          </div>
        </div>`;
    });
  });
  document.getElementById("surveyContentArea").innerHTML = html;
}

async function submitRealSurvey() {
  let answers = {};
  let complete = true;
  
  globalSurveyData.questions.forEach(q => {
    let sel = document.querySelector(`input[name="sq_${q.id}"]:checked`) || 
              document.querySelector(`textarea[name="sq_${q.id}"]`);
    if (sel && sel.value !== "") {
        answers[q.id] = sel.value;
    } else {
        complete = false;
    }
  });

  if (!complete) { 
    Swal.fire('แจ้งเตือน', 'กรุณาประเมินให้ครบทุกข้อครับ', 'warning'); 
    return; 
  }
  
  let target = currentSurveyType === 'PROJECT_SURVEY' ? 'PROJECT' : document.getElementById("speakerSelect").value;
  
  Swal.fire({ title: 'กำลังบันทึก...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});
  
  try {
    let action = currentSurveyType === 'PROJECT_SURVEY' ? 'submitProjectEval' : 'submitSpeakerEval';
    
    let res = await fetch(GAS_API_URL, { 
      method: 'POST', 
      body: JSON.stringify({ 
        action: action, 
        payload: { 
          personal_id: localStorage.getItem("tms_personal_id"), 
          answers: answers, 
          target_id: target 
        } 
      }) 
    });
    let result = await res.json();
    
    if (result.status === 'success') {
      Swal.fire('สำเร็จ', 'บันทึกเรียบร้อย', 'success').then(() => {
          backToDashboard('surveySection');
      });
    }
  } catch (e) {
    Swal.fire('ผิดพลาด', 'เชื่อมต่อไม่ได้', 'error');
  }
}
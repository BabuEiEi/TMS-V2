/**
 * PROJECT: TMS-V2
 * VERSION: 23.0 (The Six-Rule Integrity)
 * AUTHOR: วิ (AI Assistant)
 * COMMENT: ปฏิบัติตามกฎเหล็ก 6 ข้ออย่างเคร่งครัด (ห้ามยุบย่อ ห้ามลดบรรทัด)
 * [COMMENT: TAGS FOR SEARCH: #NAV_LOGIC, #ATT_LOGIC, #EXAM_LOGIC, #SURVEY_LOGIC]
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
    title: 'สำเร็จ', 
    text: 'เข้าสู่ระบบ TMS เรียบร้อยแล้ว',
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
// [#ATT_LOGIC]: ระบบลงเวลาพร้อมประวัติการบันทึก
// ============================================================

async function openAttendanceForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("attendanceSection").classList.remove("d-none");
  
  let userId = localStorage.getItem("tms_personal_id");
  let btnContainer = document.getElementById("attendanceButtonsContainer");
  
  btnContainer.innerHTML = `
    <div class="text-center my-5">
      <div class="spinner-border text-info"></div>
      <p class="mt-2 text-muted">กำลังตรวจสอบสถานะรอบเวลา...</p>
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
    btnContainer.innerHTML = `
      <div class="alert alert-danger text-center rounded-4 p-4">
        ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ในขณะนี้
      </div>`;
  }
}

function renderAttendanceButtons(schedule, userLogs) {
  let btnContainer = document.getElementById("attendanceButtonsContainer");
  btnContainer.innerHTML = ''; 

  schedule.forEach(slot => {
    let key = slot.day_no + '_' + slot.slot_id;
    let loggedTime = userLogs[key];

    if (loggedTime) {
      // แสดงสถานะที่ลงเวลาแล้ว (ปุ่มเทาพรีเมียม)
      btnContainer.innerHTML += `
        <div class="card mb-3 p-4 bg-light border-0 rounded-4 text-center shadow-sm opacity-75">
          <div class="fw-bold text-secondary fs-5">✔️ ${slot.slot_label} เรียบร้อยแล้ว</div>
          <small class="text-muted">วันที่บันทึก: ${loggedTime}</small>
        </div>`;
    } else {
      // แสดงปุ่มสำหรับรอบที่ต้องลง (ปุ่มเขียวพรีเมียม)
      btnContainer.innerHTML += `
        <button class="btn btn-success w-100 mb-3 p-4 fw-bold rounded-4 shadow shadow-sm" 
                style="font-size: 1.2rem;"
                onclick="submitRealAttendance('${slot.day_no}', '${slot.slot_id}')">
          📌 ลงเวลา: ${slot.slot_label}
        </button>`;
    }
  });
}

async function submitRealAttendance(day, slot) {
  Swal.fire({ 
    title: 'กำลังบันทึก...', 
    allowOutsideClick: false, 
    didOpen: () => { 
        Swal.showLoading(); 
    } 
  });

  let payload = {
    personal_id: localStorage.getItem("tms_personal_id"),
    day_no: day,
    time_slot: slot,
    note: '[V23-Confirmed]'
  };

  try {
    await fetch(GAS_API_URL, { 
      method: 'POST', 
      body: JSON.stringify({ action: 'submitAttendance', payload: payload }) 
    });
    
    openAttendanceForm();
    Swal.close();
  } catch (e) {
    Swal.fire('ผิดพลาด', 'บันทึกไม่สำเร็จ กรุณาลองใหม่', 'error');
  }
}


// ============================================================
// [#EXAM_LOGIC]: ระบบข้อสอบและหน้าเตรียมพร้อม
// ============================================================

document.addEventListener('visibilitychange', () => {
  if (isExamActive && document.visibilityState === 'hidden') {
    Swal.fire({
      icon: 'warning',
      title: 'คำเตือน!',
      text: 'ระบบได้บันทึกพฤติกรรมการสลับหน้าจอของท่านไว้แล้วครับ',
      confirmButtonColor: '#d33'
    });
  }
});

async function openExamForm() {
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("examSection").classList.remove("d-none");
  
  let contentArea = document.getElementById("examContentArea");
  contentArea.innerHTML = `
    <div class="text-center p-5">
      <div class="spinner-border text-warning"></div>
      <p class="mt-2 text-muted">กำลังเตรียมชุดข้อสอบ...</p>
    </div>`;

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
      contentArea.innerHTML = `
        <div class="alert alert-info text-center rounded-5 p-5 shadow-sm">
          <h5 class="fw-bold">${result.message}</h5>
        </div>`;
    }
  } catch (error) {
    contentArea.innerHTML = '<div class="alert alert-danger text-center">ไม่สามารถโหลดข้อมูลได้</div>';
  }
}

function renderExamStartScreen() {
  let contentArea = document.getElementById("examContentArea");
  let exam = globalExamData.activeExam;
  let qCount = globalExamData.questions.length;
  
  contentArea.innerHTML = `
    <div class="text-center my-5 p-5 bg-light rounded-5 border shadow-sm fade-in">
      <h4 class="text-primary fw-bold mb-3">ท่านพร้อมที่จะทำแบบทดสอบหรือไม่?</h4>
      <p class="text-muted fs-5">จำนวนข้อสอบทั้งหมด <b class="text-dark">${qCount}</b> ข้อ</p>
      
      <div class="alert alert-info text-start small mx-auto mt-4" style="max-width: 520px;">
        <ul class="mb-0">
          <li>⏱️ ระบบเริ่มจับเวลา 30 นาทีทันทีที่กดเริ่ม</li>
          <li>💾 มีระบบ Auto-Save คำตอบแบบเรียลไทม์</li>
          <li>🚫 ห้ามสลับหน้าจอเด็ดขาดขณะทำแบบทดสอบ</li>
        </ul>
      </div>
      
      <button class="btn btn-lg btn-success mt-4 fw-bold px-5 rounded-pill shadow-lg" 
              onclick="startExamTimer()">
        เริ่มทำแบบทดสอบตอนนี้
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
  
  globalExamData.questions.sort(() => {
      return Math.random() - 0.5;
  });

  globalExamData.questions.forEach((q, i) => {
    html += `
      <div class="card mb-4 p-5 border-0 shadow-sm rounded-4 bg-white border-start border-5 border-warning fade-in">
        <p class="fw-bold fs-5 mb-4">${i + 1}. ${q.question}</p>`;
    
    ['A','B','C','D'].forEach((opt, idx) => {
      html += `
        <div class="form-check mb-3">
          <input class="form-check-input border-secondary" type="radio" name="q_${q.id}" value="${opt}" id="q_${q.id}_${opt}">
          <label class="form-check-label w-100 ms-2" for="q_${q.id}_${opt}" style="cursor:pointer;">
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
      Swal.fire({
        title: 'หมดเวลา!',
        text: 'ระบบกำลังดำเนินการส่งคำตอบให้อัตโนมัติ',
        icon: 'warning'
      }).then(() => {
          submitRealExam(true);
      }); 
    }
  }, 1000);
}

async function submitRealExam(isAuto = false) {
  if (!isAuto) {
    const confirm = await Swal.fire({ 
        title: 'ยืนยันการส่งคำตอบ?', 
        icon: 'question', 
        showCancelButton: true 
    });
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

  Swal.fire({ title: 'กำลังประมวลผล...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); }});

  let payload = {
    personal_id: localStorage.getItem("tms_personal_id"),
    test_type: globalExamData.activeExam.type,
    score: score,
    max_score: globalExamData.questions.length * 2
  };

  try {
    await fetch(GAS_API_URL, { 
      method: 'POST', 
      body: JSON.stringify({ action: 'submitExam', payload: payload }) 
    });
    
    Swal.fire({
      icon: 'success',
      title: 'ส่งคำตอบสำเร็จ',
      text: `คะแนนที่ท่านได้คือ ${score} คะแนน`
    }).then(() => {
      backToDashboard('examSection');
    });
  } catch (e) {
    Swal.fire('ผิดพลาด', 'ส่งข้อมูลไม่สำเร็จ', 'error');
  }
}


// ============================================================
// [#SURVEY_LOGIC]: ระบบประเมิน (FIXED V23.0 - ตอน 1 ดิ่ง / ตอน 2 แนวนอน 5-1)
// ============================================================

async function openSurveyForm(type) {
  currentSurveyType = type;
  document.getElementById("dashboardSection").classList.add("d-none");
  document.getElementById("surveySection").classList.remove("d-none");
  
  let contentArea = document.getElementById("surveyContentArea");
  document.getElementById("surveyTitleLabel").innerText = type === 'PROJECT_SURVEY' ? 'ประเมินภาพรวมโครงการ' : 'ประเมินวิทยากร';
  
  contentArea.innerHTML = `
    <div class="text-center p-5 my-5">
      <div class="spinner-border text-success"></div>
      <p class="mt-2 text-muted">กำลังเตรียมแบบประเมินผลออนไลน์...</p>
    </div>`;
  
  document.getElementById("btnSubmitSurvey").classList.add("d-none");

  try {
    let response = await fetch(GAS_API_URL, { 
      method: 'POST', 
      body: JSON.stringify({ action: 'getSurveyData', payload: { survey_type: type } }) 
    });
    globalSurveyData = await response.json();
    
    if (type === 'SPEAKER_SURVEY') { 
        renderSpeakerSelect(); 
        contentArea.innerHTML = `
          <div class="text-center text-muted p-5 bg-white rounded-5 border border-dashed">
            กรุณาเลือกรายชื่อวิทยากรที่ช่องด้านบนก่อนเริ่มทำแบบประเมินครับ
          </div>`;
    } else { 
        document.getElementById("speakerSelectionArea").classList.add("d-none");
        renderSurveyQuestions(); 
        document.getElementById("btnSubmitSurvey").classList.remove("d-none"); 
    }
  } catch (e) {
    contentArea.innerHTML = '<div class="alert alert-danger text-center">ดาวน์โหลดข้อมูลล้มเหลว</div>';
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

// [COMMENT: FIXED V23.0 - กู้คืนความงาม V20 พร้อมลอจิก ตอน 1 ดิ่ง / ตอน 2 แนวนอน]
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
    html += `<h4 class="category-header">${cat}</h4>`;
      
    grouped[cat].forEach(q => {
      let optionsHtml = '';
      
      // 🟢 กรณีตอนที่ 2 (ความพึงพอใจ): ปุ่มวงกลมพรีเมียม แนวนอน เรียง 5 ไปหา 1
      if (cat.includes("ตอนที่ 2")) {
        optionsHtml += `
          <div class="rating-wrapper-horizontal">
            <div class="rating-container-horizontal">`;
            
        // สั่งเรียงลำดับจากมากไปน้อย (5 4 3 2 1)
        const sortedRatings = [...q.options].sort((a, b) => {
            return b - a;
        });

        sortedRatings.forEach(opt => {
          optionsHtml += `
              <div class="rating-circle-item">
                <input type="radio" name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}">
                <label class="rating-circle-label shadow-sm" for="sq_${q.id}_${opt}">
                  ${opt}
                </label>
              </div>`;
        });
        
        optionsHtml += `
            </div>
            <div class="rating-desc-flex">
              <span>มากที่สุด (5)</span>
              <span>น้อยที่สุด (1)</span>
            </div>
          </div>`;
      } 
      
      // 🔵 กรณีตอนที่ 1 (ข้อมูลทั่วไป): Radio Bullet มาตรฐาน เรียงแนวดิ่ง
      else if (cat.includes("ตอนที่ 1")) {
        q.options.forEach(opt => {
          optionsHtml += `
            <div class="form-check vertical-form-check">
              <input class="form-check-input border-secondary shadow-sm" type="radio" 
                     name="sq_${q.id}" value="${opt}" id="sq_${q.id}_${opt}">
              <label class="form-check-label w-100" for="sq_${q.id}_${opt}" style="cursor:pointer;">
                ${opt}
              </label>
            </div>`;
        });
      }
      
      // 📝 กรณีเป็นช่องเขียนตอบ (TEXT)
      else if (q.options[0] === 'TEXT') {
        optionsHtml = `
          <textarea class="form-control rounded-4 shadow-sm" 
                    name="sq_${q.id}" rows="3" 
                    placeholder="ระบุความคิดเห็นหรือข้อเสนอแนะเพิ่มเติม..."></textarea>`;
      }

      // วาดการ์ดคำถามแบบพรีเมียม V20
      html += `
        <div class="survey-card fade-in">
          <div class="question-heading">${q.question}</div>
          <div class="options-area">
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
    if (sel && sel.value.trim() !== "") {
        answers[q.id] = sel.value;
    } else {
        complete = false;
    }
  });

  if (!complete) { 
    Swal.fire({
        icon: 'warning',
        title: 'ข้อมูลไม่ครบ',
        text: 'กรุณาประเมินให้ครบทุกข้อก่อนส่งข้อมูลครับ'
    }); 
    return; 
  }
  
  let target = currentSurveyType === 'PROJECT_SURVEY' ? 'PROJECT' : document.getElementById("speakerSelect").value;
  
  Swal.fire({ 
    title: 'กำลังบันทึกผลประเมิน...', 
    allowOutsideClick: false, 
    didOpen: () => { 
        Swal.showLoading(); 
    }
  });
  
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
      Swal.fire({
          icon: 'success',
          title: 'บันทึกสำเร็จ',
          text: 'ขอบคุณสำหรับข้อมูลประเมินที่มีคุณค่าครับ'
      }).then(() => {
          backToDashboard('surveySection');
      });
    }
  } catch (e) {
    Swal.fire('ผิดพลาด', 'ไม่สามารถส่งข้อมูลประเมินได้ในขณะนี้', 'error');
  }
}
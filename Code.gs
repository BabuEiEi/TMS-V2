/**
 * PROJECT: TMS-V2
 * VERSION: 60.1 (Ultimate God Mode + Safe Routing + Cross-Sheet Eval)
 * AUTHOR: วิ (AI Assistant)
 * DESCRIPTION: รวมทุกระบบ (User, Exam, Survey, Assignment, Attendance, Admin CRUD, Report Dashboard)
 */

const DB_SHARDS = {
    'ATTENDANCE': '1xYP4j7tghaSQjG56_QHg2NHQxi3B_tpmJ-Vp5wn52cU', 
    'EXAM': '1L0LpJlvMfk_Rayr70jWXk3oYUxlNsyZHUP4AEdL1p8c',
    'PROJECT': '1LMSBlfp4E0_EtBSwhQk02podq7R8EiZrHSBeCwmanVA',
    'SPEAKER': '1suKQNqhm_DKwzHUMttEgTpPq7oIsBIj_SWO_p9kYktw',
    'ASSIGNMENT': '1Gx9b8UKkLhogO90NWLbVYsE0Fk_Rr2ZfUe4_USPcNOE'
};

// 🔮 ฟังก์ชันสร้างเวลาไทย 24 ชั่วโมง
function getThaiTime() {
    return Utilities.formatDate(new Date(), "Asia/Bangkok", "dd/MM/yyyy HH:mm:ss");
}

// ============================================================
// 🚪 [MAIN ROUTER] ประตูรับคำสั่งจากหน้าเว็บ
// ============================================================
function doPost(e) {
  try {
    var request = JSON.parse(e.postData.contents);
    var action = request.action;
    var payload = request.payload;
    
    // 🛡️ ใส่เกราะป้องกัน: ถ้าระบบไม่รู้จักคำสั่ง ให้เด้งบอกแทนที่จะล่ม
    var result = { status: 'error', message: 'ไม่รู้จักคำสั่ง: ' + action };

    // 🔄 แยกเส้นทางจราจรตามคำสั่ง (Routing)
    if (action === 'getUserProfile') { result = getUserProfile(payload.personal_id); } 
    else if (action === 'submitAttendance') { result = submitAttendance(payload); } 
    else if (action === 'getExamData') { result = getExamData(payload.personal_id); } 
    else if (action === 'submitExam') { result = submitExam(payload); }
    else if (action === 'getSurveyData') { result = getSurveyData(payload); }
    else if (action === 'submitSurvey' && payload.survey_type === 'PROJECT_SURVEY') { result = submitProjectEval(payload); }
    else if (action === 'submitSurvey' && payload.survey_type === 'SPEAKER_SURVEY') { result = submitSpeakerEval(payload); }
    else if (action === 'getAssignmentData') { result = getAssignmentData(payload.personal_id); }
    else if (action === 'submitAssignment') { result = submitAssignment(payload); }
    else if (action === 'cancelAssignment') { result = cancelAssignment(payload); }
    
    // 🛡️ ระบบ Admin
    else if (action === 'getAdminConfigs') { result = getAdminConfigs(); } 
    else if (action === 'updateConfigStatus') { result = updateConfigStatus(payload); }
    else if (action === 'manageConfig') { result = manageConfig(payload); }
    
    // 🌟 เปิดท่อเชื่อมให้ระบบหน้าบ้านดึงข้อมูลประเมินข้ามชีตได้
    else if (action === 'getEvaluationDashboardData') { result = getEvaluationDashboardData(); }
    
    // 🌟 โหลดข้อมูลดิบมหาศาลสำหรับ Dashboard สถิติ
    else if (action === 'getDashboardReport') {
      try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        
        var getSheetData = function(sheetName) {
          var sheet = ss.getSheetByName(sheetName);
          if(!sheet) return [];
          var data = sheet.getDataRange().getValues();
          if(data.length <= 1) return [];
          var headers = data.shift();
          return data.map(function(row) {
            var obj = {};
            headers.forEach(function(h, i) { obj[h] = row[i]; });
            return obj;
          });
        };

        result = {
          status: 'success',
          users: getSheetData('Users'),
          attendance: getSheetData('Attendance_Logs'),
          exam: getSheetData('Exam_Logs'),
          assignment: getSheetData('Assignment_Logs'),
          survey: getSheetData('Survey_Logs'),
          examConfig: getSheetData('Exam_Config'),
          assignConfig: getSheetData('Assignment_Config'),
          questions: getSheetData('Questions_Bank'),
          speakers: getSheetData('Speakers_Config')
        };
      } catch (err) {
        result = { status: 'error', message: err.toString() };
      }
    }

    // ส่งผลลัพธ์กลับเป็น JSON
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'error', 
      message: 'Critical System Error: ' + err.toString() 
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ============================================================
// 👤 [USER LOGIC] ข้อมูลผู้ใช้
// ============================================================
function getUserProfile(personalId) {
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = masterSs.getSheetByName('Users');
    var data = sheet.getDataRange().getDisplayValues();

    var searchId = personalId.toString().trim().toLowerCase();

    for (var i = 1; i < data.length; i++) {
        var rowId = data[i][0].toString().trim().toLowerCase();
        if (rowId === searchId) {
            return {
                status: 'success',
                data: {
                    name: data[i][1],
                    role: data[i][2],
                    area_service: data[i][3],
                    group_target: data[i][5]
                }
            };
        }
    }
    return { status: 'error', message: 'ไม่มีรหัสประจำตัวนี้ในระบบ' };
}

// ============================================================
// 🕒 [ATTENDANCE LOGIC] ระบบลงเวลา
// ============================================================
function getAttendanceData(personalId) {
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    var configs = masterSs.getSheetByName('Attendance_Config').getDataRange().getDisplayValues();
    var logs = SpreadsheetApp.openById(DB_SHARDS['ATTENDANCE']).getSheetByName('Attendance_Log').getDataRange().getDisplayValues();
    var userLogs = {};
    for (var i = 1; i < logs.length; i++) { if (logs[i][1] === personalId) userLogs[logs[i][2] + '_' + logs[i][3]] = logs[i][4]; }
    
    var schedule = [];
    for (var j = 1; j < configs.length; j++) {
        if (configs[j][7].toUpperCase() === 'TRUE') {
            schedule.push({ day_no: configs[j][1], date: configs[j][2], slot_id: configs[j][3], slot_label: configs[j][4], start_time: configs[j][5], end_time: configs[j][6] });
        }
    }
    return { status: 'success', schedule: schedule, userLogs: userLogs };
}

function submitAttendance(payload) {
    SpreadsheetApp.openById(DB_SHARDS['ATTENDANCE']).getSheetByName('Attendance_Log').appendRow(["ATT-" + new Date().getTime(), payload.personal_id, payload.day_no, payload.time_slot, getThaiTime(), payload.note]);
    return { status: 'success', message: 'บันทึกเวลาสำเร็จ' };
}

// ============================================================
// 📝 [EXAM LOGIC] ระบบแบบทดสอบ
// ============================================================
function getExamData(personalId) {
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    var configs = masterSs.getSheetByName('Exam_Config').getDataRange().getDisplayValues();
    
    var nowIsoStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss");
    var now = new Date(nowIsoStr);
    var activeExam = null;
    
    for (var i = 1; i < configs.length; i++) {
        var start = new Date(configs[i][1]); var end = new Date(configs[i][2]);
        var isActive = configs[i][3] ? configs[i][3].toString().trim().toUpperCase() === 'TRUE' : false;
        if (isActive && now >= start && now <= end) {
            activeExam = { type: configs[i][0], start_datetime: configs[i][1], end_datetime: configs[i][2], passing_percent: parseFloat(configs[i][4]) || 80 }; break;
        }
    }
    if (!activeExam) return { status: 'error', message: 'ยังไม่ถึงเวลาเปิดทำแบบทดสอบ หรือ หมดเวลาทำแบบทดสอบแล้วครับ' };
    
    var scores = SpreadsheetApp.openById(DB_SHARDS['EXAM']).getSheetByName('Test_Scores').getDataRange().getDisplayValues();
    var attempts = 0, bestScore = 0;
    for (var j = 1; j < scores.length; j++) {
        if (scores[j][1] === personalId && scores[j][2] === activeExam.type) { attempts++; bestScore = Math.max(bestScore, parseInt(scores[j][3]) || 0); }
    }
    
    var qbData = masterSs.getSheetByName('Questions_Bank').getDataRange().getDisplayValues();
    var questions = [];
    for (var k = 1; k < qbData.length; k++) {
        if (qbData[k][1] === activeExam.type + '_TEST') {
            questions.push({ id: qbData[k][0], category: qbData[k][2], question: qbData[k][3], options: { A: qbData[k][4], B: qbData[k][5], C: qbData[k][6], D: qbData[k][7] }, answer: qbData[k][9] });
        }
    }
    return { status: 'success', activeExam: activeExam, questions: questions, attempts: attempts, best_score: bestScore };
}

function submitExam(payload) {
    SpreadsheetApp.openById(DB_SHARDS['EXAM']).getSheetByName('Test_Scores').appendRow(["EXAM-" + new Date().getTime(), payload.personal_id, payload.test_type, payload.score, payload.max_score, getThaiTime()]);
    return { status: 'success', score: payload.score };
}

// ============================================================
// 📊 [SURVEY LOGIC] ระบบประเมิน (สำหรับผู้ใช้กรอก)
// ============================================================
function getSurveyData(payload) {
    var surveyType = payload.survey_type || ""; 
    var personalId = payload.personal_id || "";
    
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    var qData = masterSs.getSheetByName('Questions_Bank').getDataRange().getDisplayValues();
    var questions = [];
    for (var k = 1; k < qData.length; k++) {
        if (qData[k][1] && qData[k][1].toString().trim().toUpperCase() === surveyType.toUpperCase()) {
            questions.push({ id: qData[k][0], category: qData[k][2], question: qData[k][3], options: [qData[k][4], qData[k][5], qData[k][6], qData[k][7], qData[k][8]].filter(function(e) { return e.trim() !== ""; }) });
        }
    }
  
    var speakers = [];
    if (surveyType.toUpperCase() === 'SPEAKER_SURVEY') {
        var evaluatedList = [];
        if (personalId) {
            var evalLogs = SpreadsheetApp.openById(DB_SHARDS['SPEAKER']).getSheets()[0].getDataRange().getDisplayValues();
            for (var e = 1; e < evalLogs.length; e++) {
                if (evalLogs[e][1] === personalId) evaluatedList.push(evalLogs[e][2].toString().trim()); 
            }
        }

        var spkData = masterSs.getSheetByName('Speakers_Config').getDataRange().getDisplayValues();
        var nowIsoStr = Utilities.formatDate(new Date(), "Asia/Bangkok", "yyyy-MM-dd'T'HH:mm:ss");
        var now = new Date(nowIsoStr);
        
        for (var s = 1; s < spkData.length; s++) {
            if (!spkData[s][3] || !spkData[s][4]) continue; 
            var start = new Date(spkData[s][3]); var end = new Date(spkData[s][4]);
            var isActive = spkData[s][5] ? spkData[s][5].toString().trim().toUpperCase() === 'TRUE' : false;
            
            if (isActive && now >= start && now <= end) {
                var spkId = spkData[s][0].toString().trim();
                speakers.push({ id: spkId, name: spkData[s][1], topic: spkData[s][2], is_evaluated: evaluatedList.indexOf(spkId) !== -1 });
            }
        }
    }
    return { status: 'success', questions: questions, speakers: speakers };
}

function submitProjectEval(payload) {
    SpreadsheetApp.openById(DB_SHARDS['PROJECT']).getSheets()[0].appendRow(["PROJ-" + new Date().getTime(), payload.personal_id, JSON.stringify(payload.answers), getThaiTime()]);
    return { status: 'success' };
}

function submitSpeakerEval(payload) {
    SpreadsheetApp.openById(DB_SHARDS['SPEAKER']).getSheets()[0].appendRow(["SPK-" + new Date().getTime(), payload.personal_id, payload.target_id, JSON.stringify(payload.answers), getThaiTime()]);
    return { status: 'success' };
}

// ============================================================
// 📁 [ASSIGNMENT LOGIC] ระบบส่งงาน
// ============================================================
function getAssignmentData(personalId) {
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    var userSheet = masterSs.getSheetByName('Users');
    var usersData = userSheet.getDataRange().getDisplayValues();
    var userGroup = "ALL";
    
    for (var u = 1; u < usersData.length; u++) {
        if (usersData[u][0].toString().trim().toLowerCase() === personalId.toString().trim().toLowerCase()) { 
            userGroup = usersData[u][5].toString().trim(); break; 
        }
    }
    
    var configs = masterSs.getSheetByName('Assignment_Config').getDataRange().getDisplayValues();
    var logs = SpreadsheetApp.openById(DB_SHARDS['ASSIGNMENT']).getSheetByName('Assignment_Log').getDataRange().getDisplayValues();
    
    var assignments = [];
    var userSubmissions = {};
    
    for (var i = 1; i < configs.length; i++) {
        var isActive = configs[i][7] ? configs[i][7].toUpperCase() === 'TRUE' : false;
        if (isActive) {
            var targetGroup = configs[i][8] ? configs[i][8].toString().trim().toUpperCase() : "ALL"; 
            var targetArray = targetGroup.split(',').map(function(item) { return item.trim(); });
            var isMatchGroup = (targetGroup === "ALL" || targetGroup === "" || targetArray.indexOf(userGroup) !== -1);
            
            if (isMatchGroup) {
                assignments.push({
                    assign_id: configs[i][0], title: configs[i][1], description: configs[i][2],
                    submission_type: configs[i][3], target_folder_id: configs[i][4],
                    start_datetime: configs[i][5], end_datetime: configs[i][6]
                });
            }
        }
    }
    
    for (var j = 1; j < logs.length; j++) {
        if (logs[j][1].toString().trim().toLowerCase() === personalId.toString().trim().toLowerCase()) {
            userSubmissions[logs[j][2]] = {
                submission_type: logs[j][3], file_link: logs[j][4], timestamp: logs[j][5],
                status: logs[j][6], feedback: logs[j][7], is_late: logs[j][8]
            };
        }
    }
    return { status: 'success', assignments: assignments, userSubmissions: userSubmissions };
}

function submitAssignment(payload) {
    var assignSs = SpreadsheetApp.openById(DB_SHARDS['ASSIGNMENT']);
    var sheet = assignSs.getSheetByName('Assignment_Log');
    var rawTimestamp = new Date(); 
    var logId = "ASN-" + rawTimestamp.getTime();
    var finalLink = payload.submission_type === 'LINK' ? payload.file_link : ""; 
    
    if (payload.submission_type === 'FILE') {
        if (!payload.base64Data) return { status: 'error', message: 'ไฟล์ข้อมูลขาดหายระหว่างทาง' };
        try {
            var cleanFolderId = payload.target_folder_id ? payload.target_folder_id.toString().trim() : "";
            var urlMatch = cleanFolderId.match(/[-\w]{25,}/);
            if (urlMatch) cleanFolderId = urlMatch[0];

            var parentFolder = DriveApp.getFolderById(cleanFolderId);
            var subFolders = parentFolder.getFoldersByName(payload.assign_id);
            var targetFolder = subFolders.hasNext() ? subFolders.next() : parentFolder.createFolder(payload.assign_id);
            
            var originalName = payload.fileName || "Uploaded_File";
            var extension = originalName.lastIndexOf(".") !== -1 ? originalName.substring(originalName.lastIndexOf(".")) : "";
            var timeString = Utilities.formatDate(rawTimestamp, "Asia/Bangkok", "dd-MM-yyyy_HHmmss");
            var newFileName = payload.personal_id + "_" + timeString + extension;
            
            var blob = Utilities.newBlob(Utilities.base64Decode(payload.base64Data), payload.mimeType || MimeType.PDF, newFileName);
            var file = targetFolder.createFile(blob);
            finalLink = file.getUrl(); 
        } catch (e) {
            return { status: 'error', message: 'Drive Error: ' + e.message };
        }
    }
    
    sheet.appendRow([ logId, payload.personal_id, payload.assign_id, payload.submission_type, finalLink, getThaiTime(), "รอตรวจ", "", "", payload.is_late ]);
    return { status: 'success' };
}

function cancelAssignment(payload) {
    var sheet = SpreadsheetApp.openById(DB_SHARDS['ASSIGNMENT']).getSheetByName('Assignment_Log');
    var data = sheet.getDataRange().getValues();
    for (var i = data.length - 1; i >= 1; i--) {
        if (data[i][1] === payload.personal_id && data[i][2] === payload.assign_id) {
            if (data[i][6] === 'รอตรวจ' || data[i][6] === 'แก้ไข') {
                sheet.getRange(i + 1, 7).setValue('ยกเลิก'); return { status: 'success' };
            } else { return { status: 'error', message: 'ไม่สามารถยกเลิกได้ เนื่องจากตรวจให้คะแนนแล้ว' }; }
        }
    }
    return { status: 'error', message: 'ไม่พบประวัติการส่งงาน' };
}

// ============================================================
// 🛡️ [ADMIN API] ระบบแผงควบคุมผู้ดูแลระบบ (God Mode)
// ============================================================
function getAdminConfigs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = { status: 'success', data: {} };

  try {
    var attSheet = ss.getSheetByName('Attendance_Config');
    if (attSheet) {
      var attData = attSheet.getDataRange().getValues();
      result.data.attendance = [];
      for (var i = 1; i < attData.length; i++) {
        if (attData[i][0] !== "") {
          result.data.attendance.push({
            id: attData[i][0], date: attData[i][2], label: attData[i][4],
            time: attData[i][5] + ' - ' + attData[i][6], is_active: (attData[i][7] === true || attData[i][7] === 'TRUE')
          });
        }
      }
    }

    var examSheet = ss.getSheetByName('Exam_Config');
    if (examSheet) {
      var examData = examSheet.getDataRange().getValues();
      result.data.exam = [];
      for (var j = 1; j < examData.length; j++) {
        if (examData[j][0] !== "") {
          result.data.exam.push({
            id: examData[j][0], is_active: (examData[j][3] === true || examData[j][3] === 'TRUE')
          });
        }
      }
    }

    var spkSheet = ss.getSheetByName('Speakers_Config');
    if (spkSheet) {
      var spkData = spkSheet.getDataRange().getValues();
      result.data.speaker = [];
      for (var k = 1; k < spkData.length; k++) {
        if (spkData[k][0] !== "") {
          result.data.speaker.push({
            id: spkData[k][0], name: spkData[k][1], topic: spkData[k][2],
            is_active: (spkData[k][5] === true || spkData[k][5] === 'TRUE')
          });
        }
      }
    }

    var asnSheet = ss.getSheetByName('Assignment_Config');
    if (asnSheet) {
      var asnData = asnSheet.getDataRange().getValues();
      result.data.assignment = [];
      for (var l = 1; l < asnData.length; l++) {
        if (asnData[l][0] !== "") {
          result.data.assignment.push({
            id: asnData[l][0], title: asnData[l][1], type: asnData[l][3],
            is_active: (asnData[l][7] === true || asnData[l][7] === 'TRUE')
          });
        }
      }
    }
    return result;
  } catch (e) {
    return { status: 'error', message: 'ไม่สามารถดึงข้อมูล Config ได้: ' + e.toString() };
  }
}

function updateConfigStatus(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = '';
  var idColIndex = 0; 
  var statusColIndex = 0;

  if (payload.configType === 'ATTENDANCE') { sheetName = 'Attendance_Config'; idColIndex = 0; statusColIndex = 8; }
  else if (payload.configType === 'EXAM') { sheetName = 'Exam_Config'; idColIndex = 0; statusColIndex = 4; }
  else if (payload.configType === 'SPEAKER') { sheetName = 'Speakers_Config'; idColIndex = 0; statusColIndex = 6; }
  else if (payload.configType === 'ASSIGNMENT') { sheetName = 'Assignment_Config'; idColIndex = 0; statusColIndex = 8; }
  else { return { status: 'error', message: 'ประเภท Config ไม่ถูกต้อง' }; }

  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return { status: 'error', message: 'ไม่พบชีตฐานข้อมูล' };

  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][idColIndex].toString().trim() === payload.itemId.toString().trim()) {
      sheet.getRange(i + 1, statusColIndex).setValue(payload.isActive);
      return { status: 'success', message: 'อัปเดตเรียบร้อย' };
    }
  }
  return { status: 'error', message: 'ไม่พบรหัส' };
}

function manageConfig(payload) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var action = payload.action; 
  var sheetName = payload.sheetName; 
  var sheet = ss.getSheetByName(sheetName);

  if (!sheet) return { status: 'error', message: 'ไม่พบชีต: ' + sheetName };

  var data = sheet.getDataRange().getDisplayValues();
  var headers = data[0];

  if (action === "GET") {
    return { status: 'success', headers: headers, rows: data.slice(1) };
  }
  else if (action === "SAVE") {
    var rowData = payload.rowData;
    var isNew = payload.isNew;

    if (isNew) {
      sheet.appendRow(rowData);
    } else {
      var id = rowData[0].toString().trim();
      var found = false;
      for (var i = 1; i < data.length; i++) {
        if (data[i][0].toString().trim() === id) {
          sheet.getRange(i + 1, 1, 1, rowData.length).setValues([rowData]);
          found = true;
          break;
        }
      }
      if (!found) return { status: 'error', message: 'ไม่พบรหัสที่ต้องการแก้ไข' };
    }
    return { status: 'success', message: 'บันทึกข้อมูลเรียบร้อย' };
  }
  else if (action === "DELETE") {
    var id = payload.id.toString().trim();
    for (var j = 1; j < data.length; j++) {
      if (data[j][0].toString().trim() === id) {
        sheet.deleteRow(j + 1);
        return { status: 'success', message: 'ลบข้อมูลเรียบร้อย' };
      }
    }
    return { status: 'error', message: 'ไม่พบข้อมูลที่ต้องการลบ' };
  }
  else if (action === "IMPORT_EXCEL") {
      var excelData = payload.excelData;
      if (!excelData || excelData.length === 0) return { status: 'error', message: 'ไม่มีข้อมูลสำหรับนำเข้า' };
      
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      
      if (lastRow > 1) {
        sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
      }
      
      var cleanData = excelData.map(function(row) {
        var newRow = [];
        for(var i=0; i<lastCol; i++) {
            newRow.push(row[i] !== undefined ? row[i] : "");
        }
        return newRow;
      });

      sheet.getRange(2, 1, cleanData.length, lastCol).setValues(cleanData);
      return { status: 'success', message: 'นำเข้าข้อมูลใหม่ ' + cleanData.length + ' รายการเรียบร้อย' };
  }
  return { status: 'error', message: 'คำสั่ง Database ผิดพลาด' };
}

// ============================================================
// 📊 [REPORT API] ระบบดึงข้อมูลข้ามชีตเพื่อทำ Dashboard ประเมิน
// ============================================================
function getEvaluationDashboardData() {
    var masterSs = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. ดึงวิทยากรทั้งหมด
    var spkSheet = masterSs.getSheetByName('Speakers_Config');
    var speakers = [];
    if(spkSheet) {
        var spkData = spkSheet.getDataRange().getDisplayValues();
        for (var i = 1; i < spkData.length; i++) {
            if (spkData[i][0]) {
                speakers.push({
                    id: spkData[i][0],
                    name: spkData[i][1],
                    topic: spkData[i][2]
                });
            }
        }
    }

    // 2. ดึงคลังคำถามแบบประเมินทั้งหมด
    var qbSheet = masterSs.getSheetByName('Questions_Bank');
    var questions = {};
    if(qbSheet) {
        var qbData = qbSheet.getDataRange().getDisplayValues();
        for (var j = 1; j < qbData.length; j++) {
            var type = qbData[j][1];
            if (type === 'PROJECT_SURVEY' || type === 'SPEAKER_SURVEY') {
                questions[qbData[j][0]] = {
                    type: type,
                    category: qbData[j][2],
                    text: qbData[j][3],
                    inputType: qbData[j][4] === 'TEXT' ? 'TEXT' : (qbData[j][4] ? 'CHOICE' : 'RATING'),
                    options: [qbData[j][4], qbData[j][5], qbData[j][6], qbData[j][7], qbData[j][8]].filter(function(e) { return e && e !== 'TEXT'; })
                };
            }
        }
    }

    // 3. ดึง Log การประเมินจากชีตแยกระบบ
    var surveys = [];
    
    try {
        var projSheet = SpreadsheetApp.openById(DB_SHARDS['PROJECT']).getSheets()[0];
        var projData = projSheet.getDataRange().getDisplayValues();
        for (var p = 1; p < projData.length; p++) {
            if (projData[p][0]) {
                surveys.push({
                    logId: projData[p][0],
                    personalId: projData[p][1],
                    targetId: 'PROJECT', 
                    answers: projData[p][2] 
                });
            }
        }
    } catch(e) {} 

    try {
        var spkLogSheet = SpreadsheetApp.openById(DB_SHARDS['SPEAKER']).getSheets()[0];
        var spkLogData = spkLogSheet.getDataRange().getDisplayValues();
        for (var s = 1; s < spkLogData.length; s++) {
            if (spkLogData[s][0]) {
                surveys.push({
                    logId: spkLogData[s][0],
                    personalId: spkLogData[s][1],
                    targetId: spkLogData[s][2], 
                    answers: spkLogData[s][3] 
                });
            }
        }
    } catch(e) {} 

    return {
        status: 'success',
        speakers: speakers,
        questions: questions,
        surveys: surveys
    };
}

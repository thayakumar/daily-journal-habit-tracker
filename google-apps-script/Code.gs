function doGet(e) {
  var action = e.parameter.action;

  if (action === 'getAll') {
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Read Entries
    var entriesSheet = ss.getSheetByName('Entries');
    var entriesData = entriesSheet.getDataRange().getValues();
    var entriesHeaders = entriesData[0];
    var entries = [];
    for (var i = 1; i < entriesData.length; i++) {
      var row = entriesData[i];
      if (!row[0]) continue;
      var obj = {};
      for (var j = 0; j < entriesHeaders.length; j++) {
        obj[entriesHeaders[j]] = row[j];
      }
      if (obj.habits_json) {
        try { obj.habits = JSON.parse(obj.habits_json); } catch (err) { obj.habits = {}; }
      } else {
        obj.habits = {};
      }
      delete obj.habits_json;
      entries.push(obj);
    }

    // Read Habits
    var habitsSheet = ss.getSheetByName('Habits');
    var habitsData = habitsSheet.getDataRange().getValues();
    var habitsHeaders = habitsData[0];
    var habits = [];
    for (var i = 1; i < habitsData.length; i++) {
      var row = habitsData[i];
      if (!row[0]) continue;
      var obj = {};
      for (var j = 0; j < habitsHeaders.length; j++) {
        obj[habitsHeaders[j]] = row[j];
      }
      habits.push({
        id: obj.id,
        name: obj.name,
        color: obj.colorClass,
        lightBg: obj.lightBgClass,
        ringColor: obj.ringColorClass
      });
    }

    // Read Settings
    var settingsSheet = ss.getSheetByName('Settings');
    var settingsData = settingsSheet.getDataRange().getValues();
    var settings = {};
    for (var i = 1; i < settingsData.length; i++) {
      if (settingsData[i][0]) {
        settings[settingsData[i][0]] = String(settingsData[i][1]);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ entries: entries, habits: habits, settings: settings }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: 'Unknown action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var action = payload.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === 'saveEntries') {
    var sheet = ss.getSheetByName('Entries');
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 12).clearContent();
    }
    var rows = [];
    for (var i = 0; i < payload.data.length; i++) {
      var entry = payload.data[i];
      rows.push([
        entry.id, entry.dateStr, entry.displayDate, entry.dayName,
        entry.sleepTime, entry.exercise, entry.morningFood, entry.afternoonFood,
        entry.dinnerFood, entry.snack, entry.tasks,
        JSON.stringify(entry.habits || {})
      ]);
    }
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 12).setValues(rows);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'saveHabits') {
    var sheet = ss.getSheetByName('Habits');
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 5).clearContent();
    }
    var rows = [];
    for (var i = 0; i < payload.data.length; i++) {
      var h = payload.data[i];
      rows.push([h.id, h.name, h.color, h.lightBg, h.ringColor]);
    }
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 5).setValues(rows);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'saveSetting') {
    var sheet = ss.getSheetByName('Settings');
    var data = sheet.getDataRange().getValues();
    var found = false;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === payload.key) {
        sheet.getRange(i + 1, 2).setValue(payload.value);
        found = true;
        break;
      }
    }
    if (!found) {
      sheet.appendRow([payload.key, payload.value]);
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'addEntry') {
    var sheet = ss.getSheetByName('Entries');
    var entry = payload.data;
    sheet.appendRow([
      entry.id, entry.dateStr, entry.displayDate, entry.dayName,
      entry.sleepTime, entry.exercise, entry.morningFood, entry.afternoonFood,
      entry.dinnerFood, entry.snack, entry.tasks,
      JSON.stringify(entry.habits || {})
    ]);
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'updateEntry') {
    var sheet = ss.getSheetByName('Entries');
    var data = sheet.getDataRange().getValues();
    var entry = payload.data;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === entry.id) {
        var row = [
          entry.id, entry.dateStr, entry.displayDate, entry.dayName,
          entry.sleepTime, entry.exercise, entry.morningFood, entry.afternoonFood,
          entry.dinnerFood, entry.snack, entry.tasks,
          JSON.stringify(entry.habits || {})
        ];
        sheet.getRange(i + 1, 1, 1, 12).setValues([row]);
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  if (action === 'deleteEntry') {
    var sheet = ss.getSheetByName('Entries');
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === payload.id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ error: 'Unknown action' }))
    .setMimeType(ContentService.MimeType.JSON);
}

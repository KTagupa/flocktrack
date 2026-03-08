const assert = require("node:assert/strict");
const {
  STATUS_DATE_FIELDS,
  nextCode,
  eggCode,
  outsiderTagCode,
  parseOutsiderTagCode,
  normalizeTagId,
  getBirdPenAtDate,
  buildBirdPenUpdate,
  estimatePenFeedLog,
  buildAutomaticHatchReminders,
  stageSuggestion,
  retentionDaysForStatus,
  buildRetentionSnapshot,
  normalizeBackupPayload,
  completeReminderAndScheduleNext
} = require("../src/core/logic.shared.js");

function isoDaysAgo(days, nowMs = Date.now()) {
  return new Date(nowMs - days * 86400000).toISOString().slice(0, 10);
}

function run() {
  assert.equal(nextCode([{
    code: "B001"
  }, {
    code: "B009"
  }, {
    code: "B010"
  }]), "B011");
  assert.equal(eggCode("B007", 2), "C-B007-003");
  assert.equal(outsiderTagCode(4, 12), "OB004-012");
  assert.deepEqual(parseOutsiderTagCode("ob004-012"), {
    batchNo: 4,
    indivNo: 12
  });
  assert.equal(parseOutsiderTagCode("C-B001-001"), null);
  assert.equal(normalizeTagId(101), "101");
  assert.equal(parseOutsiderTagCode(40012), null);

  const nowMs = Date.now();
  assert.equal(stageSuggestion({
    hatchDate: isoDaysAgo(60, nowMs),
    sex: "female",
    breed: "native",
    status: "active"
  }).stage, "pullet");
  assert.equal(stageSuggestion({
    hatchDate: isoDaysAgo(45, nowMs),
    sex: "male",
    breed: "broiler",
    status: "active"
  }).stage, "broiler");
  assert.equal(stageSuggestion({
    hatchDate: isoDaysAgo(80, nowMs),
    sex: "male",
    breed: "broiler",
    status: "active"
  }).stage, "rooster");

  assert.equal(retentionDaysForStatus("sold"), 90);
  assert.equal(retentionDaysForStatus("culled"), 30);
  assert.equal(retentionDaysForStatus("active"), null);
  assert.equal(STATUS_DATE_FIELDS.sold, "soldDate");

  const snapshot = buildRetentionSnapshot({
    nowMs: new Date("2026-03-06T00:00:00.000Z").getTime(),
    birds: [{
      id: "bird-1",
      tagId: "OB001-001",
      status: "sold",
      archivedAt: "2025-10-01T00:00:00.000Z"
    }, {
      id: "bird-2",
      tagId: "OB001-002",
      status: "deceased",
      archivedAt: "2026-02-20T00:00:00.000Z"
    }],
    photos: [{
      id: "photo-1",
      birdId: "bird-1",
      dataUrl: "data:image/jpeg;base64,AAAA",
      sizeKb: 12,
      takenAt: "2025-09-25T00:00:00.000Z"
    }, {
      id: "photo-2",
      birdId: "bird-2",
      dataUrl: "data:image/jpeg;base64,BBBB",
      sizeKb: 10,
      takenAt: "2026-02-19T00:00:00.000Z"
    }, {
      id: "photo-3",
      birdId: "bird-1",
      dataUrl: "",
      sizeKb: 0,
      takenAt: "2025-09-20T00:00:00.000Z"
    }]
  });
  assert.equal(snapshot.archivedPhotos, 3);
  assert.equal(snapshot.archivedPhotosWithImage, 2);
  assert.equal(snapshot.eligible.length, 1);
  assert.equal(snapshot.eligible[0].photo.id, "photo-1");
  assert.equal(snapshot.eligible[0].bird.id, "bird-1");

  const normalizedBackup = normalizeBackupPayload({
    stores: {
      birds: [{
        id: "bird-1"
      }],
      measurements: [{
        id: "measurement-1"
      }]
    }
  }, ["birds", "measurements", "eggBatches"]);
  assert.equal(normalizedBackup.total, 2);
  assert.deepEqual(normalizedBackup.normalized.eggBatches, []);
  assert.throws(() => normalizeBackupPayload({
    foo: []
  }, ["birds"]), /recognized store data/i);

  const reminderResult = completeReminderAndScheduleNext({
    id: "inst-1",
    birdId: "bird-1",
    kind: "checkup",
    dueAt: "2026-03-01T00:00:00.000Z",
    status: "pending",
    ruleId: "rule-1"
  }, {
    id: "rule-1",
    cadenceDays: 7
  }, {
    nowIso: "2026-03-06T12:00:00.000Z",
    makeId: () => "inst-2"
  });
  assert.equal(reminderResult.completed.status, "done");
  assert.equal(reminderResult.completed.completedAt, "2026-03-06T12:00:00.000Z");
  assert.equal(reminderResult.next.id, "inst-2");
  assert.equal(reminderResult.next.dueAt, "2026-03-13T12:00:00.000Z");

  const hatchReminders = buildAutomaticHatchReminders({
    batches: [{
      id: "batch-1",
      code: "B001",
      collectedDate: "2026-03-01",
      eggCount: 12
    }, {
      id: "batch-2",
      code: "B002",
      collectedDate: "2026-03-02",
      eggCount: 6
    }],
    eggStates: [{
      id: "egg-1",
      batchId: "batch-1",
      status: "hatched"
    }, {
      id: "egg-2",
      batchId: "batch-1",
      status: "failed"
    }, {
      id: "egg-3",
      batchId: "batch-2",
      status: "hatched"
    }, {
      id: "egg-4",
      batchId: "batch-2",
      status: "hatched"
    }, {
      id: "egg-5",
      batchId: "batch-2",
      status: "hatched"
    }, {
      id: "egg-6",
      batchId: "batch-2",
      status: "hatched"
    }, {
      id: "egg-7",
      batchId: "batch-2",
      status: "hatched"
    }, {
      id: "egg-8",
      batchId: "batch-2",
      status: "hatched"
    }]
  });
  assert.equal(hatchReminders.length, 1);
  assert.equal(hatchReminders[0].id, "auto-hatch-batch-1");
  assert.equal(hatchReminders[0].batchCode, "B001");
  assert.equal(hatchReminders[0].pendingEggCount, 10);
  assert.equal(hatchReminders[0].expectedHatchDate, "2026-03-22");
  assert.equal(hatchReminders[0].dueAt, "2026-03-22T12:00:00.000Z");
  assert.equal(hatchReminders[0].auto, true);

  const penUpdatedBird = buildBirdPenUpdate({
    bird: {
      penId: "pen-a",
      penHistory: [{
        id: "move-1",
        date: "2026-03-01",
        fromPenId: null,
        toPenId: "pen-a",
        reason: "pen_assignment"
      }]
    },
    nextPenId: "pen-b",
    nextStatus: "active",
    changeDate: "2026-03-04",
    makeId: () => "move-2"
  });
  assert.equal(penUpdatedBird.penId, "pen-b");
  assert.equal(penUpdatedBird.penHistory.length, 2);
  assert.equal(getBirdPenAtDate({
    penId: "pen-b",
    penHistory: penUpdatedBird.penHistory
  }, "2026-03-02"), "pen-a");
  assert.equal(getBirdPenAtDate({
    penId: "pen-b",
    penHistory: penUpdatedBird.penHistory
  }, "2026-03-05"), "pen-b");

  const feedEstimate = estimatePenFeedLog({
    log: {
      penId: "pen-b",
      loggedAt: "2026-03-05",
      amount: 6
    },
    birds: [{
      id: "bird-1",
      status: "active",
      penId: "pen-b",
      penHistory: penUpdatedBird.penHistory
    }, {
      id: "bird-2",
      status: "sold",
      soldDate: "2026-03-05",
      penId: null,
      penHistory: [{
        id: "move-1",
        date: "2026-03-01",
        fromPenId: null,
        toPenId: "pen-b",
        reason: "pen_assignment"
      }, {
        id: "move-2",
        date: "2026-03-05",
        fromPenId: "pen-b",
        toPenId: null,
        reason: "status_sold"
      }]
    }, {
      id: "bird-3",
      status: "active",
      penId: "pen-b",
      penHistory: [{
        id: "move-1",
        date: "2026-03-02",
        fromPenId: null,
        toPenId: "pen-b",
        reason: "pen_assignment"
      }]
    }]
  });
  assert.equal(feedEstimate.birdCount, 2);
  assert.equal(feedEstimate.perBirdAmount, 3);
}

run();
console.log("logic tests passed");

const assert = require("node:assert/strict");

globalThis.FlockTrackLogic = require("../src/core/logic.shared.js");
globalThis.FlockTrackData = {
  loadCoreData: async () => ({}),
  loadPhotoExportRows: async () => [],
  loadBirdPhotos: async () => [],
  exportAllStores: async () => ({
    stores: {},
    total: 0
  }),
  replaceStores: async () => {},
  clearAllStores: async () => {}
};

const {
  __syncMergeTest
} = require("../src/app-shell.js");

const {
  mergeBirdConflictRow,
  mergeMeasurementConflictRow,
  mergeHealthConflictRow,
  mergeStoreRows
} = __syncMergeTest;

function run() {
  const localBird = {
    id: "bird-1",
    tagId: "TAG-LOCAL",
    breed: "Native Local",
    stage: "grower",
    notes: "local note",
    status: "sold",
    soldDate: "2026-02-10",
    penId: "pen-local",
    updatedAt: "2026-03-05T12:00:00.000Z",
    statusHistory: [{
      id: "status-1",
      status: "sold",
      previousStatus: "active",
      date: "2026-02-10"
    }],
    penHistory: [{
      id: "pen-1",
      date: "2026-02-01",
      toPenId: "pen-local"
    }]
  };
  const remoteBird = {
    id: "bird-1",
    tagId: "TAG-REMOTE",
    breed: "Native Remote",
    stage: "layer",
    notes: "",
    status: "deceased",
    deceasedDate: "2026-03-06",
    causeOfDeath: "respiratory issue",
    penId: "pen-remote-old",
    updatedAt: "2026-03-01T08:00:00.000Z",
    statusHistory: [{
      id: "status-2",
      status: "deceased",
      previousStatus: "sold",
      date: "2026-03-06"
    }],
    penHistory: [{
      id: "pen-2",
      date: "2026-03-04",
      toPenId: "pen-remote"
    }]
  };
  const mergedBird = mergeBirdConflictRow(localBird, remoteBird, "remote");
  assert.equal(mergedBird.id, "bird-1");
  assert.equal(mergedBird.tagId, "TAG-LOCAL");
  assert.equal(mergedBird.breed, "Native Local");
  assert.equal(mergedBird.notes, "local note");
  assert.equal(mergedBird.status, "deceased");
  assert.equal(mergedBird.deceasedDate, "2026-03-06");
  assert.equal(mergedBird.causeOfDeath, "respiratory issue");
  assert.equal(mergedBird.penId, "pen-remote");
  assert.equal(mergedBird.statusHistory.length, 2);
  assert.equal(mergedBird.penHistory.length, 2);

  const mergedBirdRows = mergeStoreRows("birds", [localBird], [remoteBird], "remote");
  assert.equal(mergedBirdRows.conflicts, 1);
  assert.equal(mergedBirdRows.rows.length, 1);
  assert.equal(mergedBirdRows.rows[0].status, "deceased");
  assert.equal(mergedBirdRows.keptLocal, 1);
  assert.equal(mergedBirdRows.keptRemote, 1);

  const localMeasurement = {
    id: "measurement-1",
    birdId: "bird-1",
    metricType: "weight",
    value: 2.45,
    unit: "kg",
    measuredAt: "2026-03-06",
    notes: ""
  };
  const remoteMeasurement = {
    id: "measurement-1",
    birdId: "bird-1",
    metricType: "weight",
    value: 2.2,
    unit: "kg",
    measuredAt: "2026-03-01",
    notes: "first baseline"
  };
  const mergedMeasurement = mergeMeasurementConflictRow(localMeasurement, remoteMeasurement, "remote");
  assert.equal(mergedMeasurement.value, 2.45);
  assert.equal(mergedMeasurement.measuredAt, "2026-03-06");
  assert.equal(mergedMeasurement.notes, "first baseline");

  const tieLocalMeasurement = mergeMeasurementConflictRow({
    id: "measurement-2",
    birdId: "bird-1",
    metricType: "weight",
    value: 2.6,
    unit: "kg",
    measuredAt: "2026-03-07",
    notes: "local tie"
  }, {
    id: "measurement-2",
    birdId: "bird-1",
    metricType: "weight",
    value: 2.6,
    unit: "lb",
    measuredAt: "2026-03-07",
    notes: "remote tie"
  }, "local");
  assert.equal(tieLocalMeasurement.unit, "kg");
  assert.equal(tieLocalMeasurement.notes, "local tie");

  const tieRemoteMeasurement = mergeMeasurementConflictRow({
    id: "measurement-2",
    birdId: "bird-1",
    metricType: "weight",
    value: 2.6,
    unit: "kg",
    measuredAt: "2026-03-07",
    notes: "local tie"
  }, {
    id: "measurement-2",
    birdId: "bird-1",
    metricType: "weight",
    value: 2.6,
    unit: "lb",
    measuredAt: "2026-03-07",
    notes: "remote tie"
  }, "remote");
  assert.equal(tieRemoteMeasurement.unit, "lb");
  assert.equal(tieRemoteMeasurement.notes, "remote tie");

  const localHealth = {
    id: "health-1",
    birdId: "bird-1",
    eventType: "treatment",
    eventDate: "2026-03-06",
    details: "local follow-up treatment",
    medication: "oxytetracycline",
    dose: "3ml",
    outcome: ""
  };
  const remoteHealth = {
    id: "health-1",
    birdId: "bird-1",
    eventType: "treatment",
    eventDate: "2026-03-01",
    details: "remote initial treatment",
    medication: "oxytetracycline",
    dose: "2ml",
    outcome: "improved appetite"
  };
  const mergedHealth = mergeHealthConflictRow(localHealth, remoteHealth, "remote");
  assert.equal(mergedHealth.details, "local follow-up treatment");
  assert.equal(mergedHealth.eventDate, "2026-03-06");
  assert.equal(mergedHealth.dose, "3ml");
  assert.equal(mergedHealth.outcome, "improved appetite");

  const mergedHealthRows = mergeStoreRows("healthEvents", [localHealth], [remoteHealth], "remote");
  assert.equal(mergedHealthRows.conflicts, 1);
  assert.equal(mergedHealthRows.rows.length, 1);
  assert.equal(mergedHealthRows.rows[0].outcome, "improved appetite");
  assert.equal(mergedHealthRows.keptLocal, 1);
  assert.equal(mergedHealthRows.keptRemote, 1);
}

run();
console.log("sync merge tests passed");

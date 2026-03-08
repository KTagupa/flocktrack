(function(root, factory) {
  const api = factory();
  root.FlockTrackLogic = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function() {
  const DAY_MS = 86400000;
  const STAGE_SUGGESTION_DAYS = {
    chickMax: 42,
    juvenileMax: 140,
    broilerStart: 35,
    broilerMature: 63
  };
  const RETENTION_DAYS = {
    sold: 90,
    deceased: 30,
    culled: 30
  };
  const HATCH_INCUBATION_DAYS = 21;
  const HATCH_ALERT_WINDOW_DAYS = 2;
  const STATUS_DATE_FIELDS = {
    sold: "soldDate",
    deceased: "deceasedDate",
    culled: "culledDate"
  };
  const normalizeTagId = tag => String(tag == null ? "" : tag).trim().toUpperCase();
  const ageDays = (dateValue, nowMs = Date.now()) => dateValue ? Math.floor((nowMs - new Date(dateValue).getTime()) / DAY_MS) : null;
  const pad3 = n => String(Math.max(1, Number(n) || 1)).padStart(3, "0");
  const nextCode = batches => {
    let max = 0;
    batches.forEach(batch => {
      const match = batch.code && batch.code.match(/(\d+)$/);
      if (match) max = Math.max(max, Number(match[1]) || 0);
    });
    return `B${String(max + 1).padStart(3, "0")}`;
  };
  const eggCode = (batchCode, index) => {
    const match = (batchCode || "").match(/(\d+)$/);
    return `C-B${match ? match[1].padStart(3, "0") : "000"}-${String(index + 1).padStart(3, "0")}`;
  };
  const outsiderTagCode = (batchNo, indivNo) => `OB${pad3(batchNo)}-${pad3(indivNo)}`;
  const parseOutsiderTagCode = tagId => {
    const match = normalizeTagId(tagId).match(/^OB(\d{3})-(\d{3})$/);
    if (!match) return null;
    return {
      batchNo: Number(match[1]) || 1,
      indivNo: Number(match[2]) || 1
    };
  };
  const normalizeDay = value => {
    if (!value) return "";
    const ms = new Date(value).getTime();
    if (!Number.isFinite(ms)) return "";
    return new Date(ms).toISOString().slice(0, 10);
  };
  const addDaysToDay = (dayValue, offsetDays) => {
    const day = normalizeDay(dayValue);
    if (!day) return "";
    const ms = new Date(`${day}T00:00:00.000Z`).getTime();
    if (!Number.isFinite(ms)) return "";
    return new Date(ms + (Number(offsetDays) || 0) * DAY_MS).toISOString().slice(0, 10);
  };
  const dayToNoonIso = dayValue => {
    const day = normalizeDay(dayValue);
    return day ? new Date(`${day}T12:00:00.000Z`).toISOString() : "";
  };
  const getBirdInactiveDate = bird => {
    if (!bird) return "";
    if (bird.status === "sold") return normalizeDay(bird.soldDate);
    if (bird.status === "deceased") return normalizeDay(bird.deceasedDate);
    if (bird.status === "culled") return normalizeDay(bird.culledDate);
    return "";
  };
  const isBirdActiveOnDate = (bird, dateValue) => {
    if (!bird) return false;
    const targetDay = normalizeDay(dateValue);
    const inactiveDay = getBirdInactiveDate(bird);
    if (!targetDay) return bird.status === "active";
    if (!inactiveDay) return true;
    return targetDay < inactiveDay;
  };
  const getBirdPenAtDate = (bird, dateValue) => {
    if (!bird) return null;
    const targetDay = normalizeDay(dateValue);
    const history = Array.isArray(bird.penHistory) ? [...bird.penHistory] : [];
    if (!history.length) return isBirdActiveOnDate(bird, dateValue) ? bird.penId || null : null;
    history.sort((a, b) => {
      const diff = new Date(a.date || a.createdAt || 0).getTime() - new Date(b.date || b.createdAt || 0).getTime();
      return diff || String(a.id || "").localeCompare(String(b.id || ""));
    });
    let penId = null;
    history.forEach(entry => {
      const entryDay = normalizeDay(entry.date || entry.createdAt);
      if (!entryDay) return;
      if (targetDay && entryDay > targetDay) return;
      penId = entry.toPenId || null;
    });
    if (!targetDay) return penId;
    return isBirdActiveOnDate(bird, dateValue) ? penId : null;
  };
  const buildBirdPenUpdate = ({
    bird,
    nextPenId,
    nextStatus,
    changeDate,
    reason,
    makeId
  }) => {
    const prevPenId = bird?.penId || null;
    const resolvedPenId = nextStatus && nextStatus !== "active" ? null : nextPenId || null;
    const history = Array.isArray(bird?.penHistory) ? [...bird.penHistory] : [];
    if (prevPenId === resolvedPenId) {
      return {
        penId: resolvedPenId,
        penHistory: history
      };
    }
    const createId = typeof makeId === "function" ? makeId : defaultMakeId;
    history.push({
      id: createId(),
      date: normalizeDay(changeDate) || normalizeDay(new Date().toISOString()),
      fromPenId: prevPenId,
      toPenId: resolvedPenId,
      reason: reason || (resolvedPenId ? prevPenId ? "pen_transfer" : "pen_assignment" : nextStatus && nextStatus !== "active" ? `status_${nextStatus}` : "pen_cleared")
    });
    return {
      penId: resolvedPenId,
      penHistory: history
    };
  };
  const estimatePenFeedLog = ({
    log,
    birds = []
  }) => {
    const matchedBirds = birds.filter(bird => isBirdActiveOnDate(bird, log?.loggedAt) && getBirdPenAtDate(bird, log?.loggedAt) === (log?.penId || null));
    const amount = Number(log?.amount) || 0;
    return {
      birdIds: matchedBirds.map(bird => bird.id),
      birdCount: matchedBirds.length,
      perBirdAmount: matchedBirds.length ? amount / matchedBirds.length : 0
    };
  };
  const buildAutomaticHatchReminders = ({
    batches = [],
    eggStates = []
  } = {}) => {
    const stateCounts = new Map();
    eggStates.forEach(state => {
      if (!state?.batchId) return;
      const current = stateCounts.get(state.batchId) || {
        hatched: 0,
        failed: 0
      };
      if (state.status === "hatched") current.hatched += 1;
      if (state.status === "failed") current.failed += 1;
      stateCounts.set(state.batchId, current);
    });
    return batches.map(batch => {
      const counts = stateCounts.get(batch.id) || {
        hatched: 0,
        failed: 0
      };
      const eggCount = Math.max(0, Number(batch.eggCount) || 0);
      const pendingEggCount = Math.max(0, eggCount - counts.hatched - counts.failed);
      if (!pendingEggCount) return null;
      const expectedHatchDate = normalizeDay(batch.expectedHatchDate || batch.hatchDate) || addDaysToDay(batch.collectedDate, HATCH_INCUBATION_DAYS);
      if (!expectedHatchDate) return null;
      return {
        id: `auto-hatch-${batch.id}`,
        batchId: batch.id,
        batchCode: batch.code || "",
        pendingEggCount,
        kind: "hatch_due",
        dueAt: dayToNoonIso(expectedHatchDate),
        expectedHatchDate,
        source: "auto_hatch",
        auto: true,
        status: "pending"
      };
    }).filter(Boolean).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  };
  const retentionDaysForStatus = status => RETENTION_DAYS[status] || null;
  const stageSuggestion = bird => {
    if (!bird || !bird.hatchDate) return null;
    if (bird.status && bird.status !== "active") return null;
    if (bird.stage === "retired") return null;
    const daysOld = ageDays(bird.hatchDate);
    if (!Number.isFinite(daysOld) || daysOld < 0) return null;
    const sex = String(bird.sex == null ? "unknown" : bird.sex).toLowerCase();
    const breed = String(bird.breed == null ? "" : bird.breed).toLowerCase();
    const isBroiler = /\bbroiler\b/.test(breed);
    if (isBroiler) {
      if (daysOld < STAGE_SUGGESTION_DAYS.broilerStart) return {
        stage: "chick",
        ageDays: daysOld,
        reason: `Age ${daysOld} days is still in the chick window.`
      };
      if (daysOld < STAGE_SUGGESTION_DAYS.broilerMature) return {
        stage: "broiler",
        ageDays: daysOld,
        reason: `Age ${daysOld} days fits the broiler production window.`
      };
      if (sex === "male") return {
        stage: "rooster",
        ageDays: daysOld,
        reason: `Male broilers at ${daysOld} days are usually managed as roosters.`
      };
      return {
        stage: "broiler",
        ageDays: daysOld,
        reason: `Broiler profile remains appropriate at ${daysOld} days.`
      };
    }
    if (sex === "female") {
      if (daysOld < STAGE_SUGGESTION_DAYS.chickMax) return {
        stage: "chick",
        ageDays: daysOld,
        reason: `Female bird is ${daysOld} days old (< ${STAGE_SUGGESTION_DAYS.chickMax} days).`
      };
      if (daysOld < STAGE_SUGGESTION_DAYS.juvenileMax) return {
        stage: "pullet",
        ageDays: daysOld,
        reason: `Female bird at ${daysOld} days is usually in the pullet stage.`
      };
      return {
        stage: "layer",
        ageDays: daysOld,
        reason: `Female bird at ${daysOld} days is typically layer-age.`
      };
    }
    if (sex === "male") {
      if (daysOld < STAGE_SUGGESTION_DAYS.chickMax) return {
        stage: "chick",
        ageDays: daysOld,
        reason: `Male bird is ${daysOld} days old (< ${STAGE_SUGGESTION_DAYS.chickMax} days).`
      };
      if (daysOld < STAGE_SUGGESTION_DAYS.juvenileMax) return {
        stage: "grower",
        ageDays: daysOld,
        reason: `Male bird at ${daysOld} days is usually in grower stage.`
      };
      return {
        stage: "rooster",
        ageDays: daysOld,
        reason: `Male bird at ${daysOld} days is typically rooster-age.`
      };
    }
    if (daysOld < STAGE_SUGGESTION_DAYS.chickMax) return {
      stage: "chick",
      ageDays: daysOld,
      reason: `At ${daysOld} days, chick is the usual stage.`
    };
    if (daysOld < STAGE_SUGGESTION_DAYS.juvenileMax) return {
      stage: "grower",
      ageDays: daysOld,
      reason: `At ${daysOld} days, grower is a safe age-based stage for unknown sex.`
    };
    return null;
  };
  const buildRetentionSnapshot = ({
    birds = [],
    photos = [],
    nowMs = Date.now()
  }) => {
    const birdById = new Map(birds.map(bird => [bird.id, bird]));
    let archivedPhotos = 0;
    let archivedPhotosWithImage = 0;
    let archivedImageBytes = 0;
    const eligible = [];
    photos.forEach(photo => {
      const bird = birdById.get(photo.birdId);
      if (!bird || !bird.archivedAt) return;
      archivedPhotos += 1;
      if (photo.dataUrl) {
        archivedPhotosWithImage += 1;
        archivedImageBytes += Math.round(photo.dataUrl.length * 0.75);
      }
      const retentionDays = retentionDaysForStatus(bird.status);
      if (!retentionDays || !photo.dataUrl) return;
      const archivedAtMs = new Date(bird.archivedAt).getTime();
      if (!Number.isFinite(archivedAtMs)) return;
      const ageMs = nowMs - archivedAtMs;
      if (ageMs < retentionDays * DAY_MS) return;
      eligible.push({
        photo,
        bird,
        retentionDays,
        ageDays: Math.floor(ageMs / DAY_MS),
        purgeAfter: new Date(archivedAtMs + retentionDays * DAY_MS).toISOString()
      });
    });
    return {
      rows: photos,
      archivedPhotos,
      archivedPhotosWithImage,
      archivedImageBytes,
      eligible
    };
  };
  const normalizeBackupPayload = (parsed, storeNames) => {
    const source = parsed && typeof parsed === "object" ? parsed.stores && typeof parsed.stores === "object" ? parsed.stores : parsed : null;
    if (!source) throw new Error("Invalid backup JSON.");
    const names = Array.isArray(storeNames) ? storeNames : [];
    const hasKnownStore = names.some(name => Array.isArray(source[name]));
    if (!hasKnownStore) throw new Error("Backup JSON has no recognized store data.");
    const normalized = {};
    let total = 0;
    names.forEach(name => {
      normalized[name] = Array.isArray(source[name]) ? source[name] : [];
      total += normalized[name].length;
    });
    return {
      normalized,
      total
    };
  };
  const defaultMakeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const completeReminderAndScheduleNext = (inst, rule, options = {}) => {
    const nowIso = options.nowIso || new Date().toISOString();
    const makeId = typeof options.makeId === "function" ? options.makeId : defaultMakeId;
    const completed = {
      ...inst,
      status: "done",
      completedAt: nowIso
    };
    const cadenceDays = Number(rule?.cadenceDays);
    const nowMs = new Date(nowIso).getTime();
    const next = rule && Number.isFinite(cadenceDays) && cadenceDays > 0 && Number.isFinite(nowMs) ? {
      id: makeId(),
      birdId: inst.birdId,
      kind: inst.kind,
      dueAt: new Date(nowMs + cadenceDays * DAY_MS).toISOString(),
      status: "pending",
      ruleId: rule.id
    } : null;
    return {
      completed,
      next
    };
  };
  return {
    DAY_MS,
    HATCH_INCUBATION_DAYS,
    HATCH_ALERT_WINDOW_DAYS,
    RETENTION_DAYS,
    STATUS_DATE_FIELDS,
    normalizeTagId,
    normalizeDay,
    addDaysToDay,
    nextCode,
    eggCode,
    outsiderTagCode,
    parseOutsiderTagCode,
    getBirdPenAtDate,
    isBirdActiveOnDate,
    buildBirdPenUpdate,
    estimatePenFeedLog,
    buildAutomaticHatchReminders,
    stageSuggestion,
    retentionDaysForStatus,
    buildRetentionSnapshot,
    normalizeBackupPayload,
    completeReminderAndScheduleNext
  };
});

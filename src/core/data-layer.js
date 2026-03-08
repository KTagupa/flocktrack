(function(root) {
  const toPhotoExportRows = rows => rows.map(photo => ({
    id: photo.id,
    birdId: photo.birdId,
    takenAt: photo.takenAt,
    sizeKb: photo.sizeKb,
    hasImage: photo.hasImage != null ? !!photo.hasImage : !!photo.dataUrl
  }));
  root.FlockTrackData = {
    loadCoreData: async () => {
      const [eggBatches, birds, measurements, healthEvents, reminderRules, reminderInstances, eggStates, pens, feedTypes, penFeedLogs] = await Promise.all(CORE_STORES.map(store => dbAll(store)));
      return {
        eggBatches,
        birds,
        measurements,
        healthEvents,
        reminderRules,
        reminderInstances,
        eggStates: eggStates || [],
        pens: pens || [],
        feedTypes: feedTypes || [],
        penFeedLogs: penFeedLogs || []
      };
    },
    loadPhotoExportRows: async () => toPhotoExportRows(await dbAll("birdPhotos")),
    loadBirdPhotos: async birdId => {
      const rows = await dbByIndex("birdPhotos", "birdId", birdId);
      rows.sort((a, b) => new Date(a.takenAt || 0) - new Date(b.takenAt || 0));
      return rows;
    },
    exportAllStores: async () => {
      const stores = {};
      let total = 0;
      for (const store of STORES) {
        const rows = await dbAll(store);
        stores[store] = rows;
        total += rows.length;
      }
      return {
        stores,
        total
      };
    },
    replaceStores: async normalized => {
      for (const store of STORES) await dbReplace(store, normalized[store] || []);
    },
    clearAllStores: async () => {
      for (const store of STORES) await dbClear(store);
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : this);

function Batches({
  batches,
  eggStates,
  onAdd,
  onUpdate,
  onHatch,
  onDelete,
  onSaveEgg,
  openBatchId = "",
  onOpenBatchHandled
}) {
  const [showNew, setShowNew] = useState(false);
  const [editB, setEditB] = useState(null);
  const [gridB, setGridB] = useState(null);
  const [eggAct, setEggAct] = useState(null);
  const [form, setForm] = useState({
    date: today(),
    count: "",
    notes: ""
  });
  const [ef, setEf] = useState({
    date: "",
    count: "",
    notes: ""
  });
  const [hf, setHf] = useState({
    breed: "",
    sex: "unknown",
    hatchDate: today(),
    notes: ""
  });
  const [failNote, setFailNote] = useState("");
  const newCode = nextCode(batches);
  const batchStatsById = useMemo(() => {
    const map = new Map();
    batches.forEach(b => map.set(b.id, {
      hatched: 0,
      failed: 0,
      pending: b.eggCount
    }));
    eggStates.forEach(state => {
      const current = map.get(state.batchId);
      if (!current) return;
      if (state.status === "hatched") current.hatched += 1;
      if (state.status === "failed") current.failed += 1;
    });
    map.forEach((stats, batchId) => {
      const batch = batches.find(b => b.id === batchId);
      const eggCount = batch?.eggCount || 0;
      stats.pending = Math.max(0, eggCount - stats.hatched - stats.failed);
      stats.eggCount = eggCount;
    });
    return map;
  }, [batches, eggStates]);
  const hatcheryTotals = useMemo(() => {
    const totalEggs = batches.reduce((sum, batch) => sum + (batch.eggCount || 0), 0);
    let hatched = 0;
    let failed = 0;
    batchStatsById.forEach(stats => {
      hatched += stats.hatched || 0;
      failed += stats.failed || 0;
    });
    return {
      totalEggs,
      hatched,
      failed,
      pending: Math.max(0, totalEggs - hatched - failed)
    };
  }, [batchStatsById, batches]);
  useEffect(() => {
    if (!openBatchId) return;
    const targetBatch = batches.find(batch => batch.id === openBatchId) || null;
    if (targetBatch) setGridB(prev => prev?.id === targetBatch.id ? prev : targetBatch);
    if (typeof onOpenBatchHandled === "function") onOpenBatchHandled();
  }, [batches, onOpenBatchHandled, openBatchId]);
  useEffect(() => {
    if (!gridB?.id) return;
    const nextBatch = batches.find(batch => batch.id === gridB.id) || null;
    if (!nextBatch) {
      setGridB(null);
      return;
    }
    if (nextBatch !== gridB) setGridB(nextBatch);
  }, [batches, gridB]);
  function saveBatch() {
    if (!form.count) return;
    onAdd({
      id: uid(),
      code: newCode,
      collectedDate: form.date,
      eggCount: +form.count,
      notes: form.notes,
      createdAt: new Date().toISOString()
    });
    setForm({
      date: today(),
      count: "",
      notes: ""
    });
    setShowNew(false);
  }
  function saveEdit() {
    if (!ef.count) return;
    onUpdate({
      ...editB,
      collectedDate: ef.date,
      eggCount: +ef.count,
      notes: ef.notes
    });
    setEditB(null);
  }
  function toggleBatchBookmark(batch) {
    if (!batch) return;
    const nextBookmarked = !batch.bookmarked;
    onUpdate({
      ...batch,
      bookmarked: nextBookmarked,
      bookmarkedAt: nextBookmarked ? new Date().toISOString() : ""
    });
  }
  function tapEgg(code, batchId, idx) {
    if (eggStates.find(s => s.id === code)) return;
    setEggAct({
      code,
      batchId,
      idx,
      mode: null
    });
    setHf({
      breed: "",
      sex: "unknown",
      hatchDate: today(),
      notes: ""
    });
    setFailNote("");
  }
  function doHatch() {
    const bird = {
      id: uid(),
      tagId: eggAct.code,
      originBatchId: eggAct.batchId,
      hatchDate: hf.hatchDate,
      stage: "chick",
      breed: hf.breed,
      sex: hf.sex,
      status: "active",
      notes: hf.notes,
      createdAt: new Date().toISOString()
    };
    onHatch(bird);
    onSaveEgg({
      id: eggAct.code,
      batchId: eggAct.batchId,
      idx: eggAct.idx,
      status: "hatched",
      birdId: bird.id,
      date: hf.hatchDate,
      note: ""
    });
    setEggAct(null);
  }
  function doFail() {
    onSaveEgg({
      id: eggAct.code,
      batchId: eggAct.batchId,
      idx: eggAct.idx,
      status: "failed",
      birdId: null,
      date: today(),
      note: failNote
    });
    setEggAct(null);
  }
  return React.createElement("div", {
    style: C.body
  }, React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      padding: "20px 0 14px"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 900,
      color: "#0f172a"
    }
  }, "\uD83E\uDD5A Hatchery"), React.createElement("button", {
    style: {
      ...C.btn,
      width: "auto",
      marginTop: 0,
      padding: "12px 20px"
    },
    onClick: () => setShowNew(true)
  }, "+ New")), batches.length > 0 && React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(2,minmax(0,1fr))",
      gap: 10,
      marginBottom: 12
    }
  }, [{
    label: "Total Eggs",
    value: fmtNum(hatcheryTotals.totalEggs),
    color: "#b45309"
  }, {
    label: "Hatched",
    value: fmtNum(hatcheryTotals.hatched),
    color: "#15803d"
  }, {
    label: "Failed",
    value: fmtNum(hatcheryTotals.failed),
    color: "#b91c1c"
  }, {
    label: "Pending",
    value: fmtNum(hatcheryTotals.pending),
    color: "#475569"
  }, {
    label: "Hatch Rate",
    value: fmtPct(hatcheryTotals.hatched, hatcheryTotals.totalEggs),
    color: "#0f766e"
  }, {
    label: "Fail Rate",
    value: fmtPct(hatcheryTotals.failed, hatcheryTotals.totalEggs),
    color: "#7c3aed"
  }].map(card => React.createElement("div", {
    key: card.label,
    style: {
      background: "#ffffff",
      border: "1px solid #d9e3ef",
      borderRadius: 14,
      padding: "12px 13px"
    }
  }, React.createElement("div", {
    style: {
      fontSize: 11,
      color: "#475569",
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: ".05em"
    }
  }, card.label), React.createElement("div", {
    style: {
      fontSize: 24,
      fontWeight: 900,
      color: card.color,
      marginTop: 4
    }
  }, card.value)))), !batches.length && React.createElement(Empty, {
    icon: "\uD83E\uDD5A",
    msg: "No batches yet"
  }), batches.map(b => {
    const stats = batchStatsById.get(b.id) || {
      hatched: 0,
      failed: 0,
      pending: b.eggCount
    };
    const hatched = stats.hatched || 0;
    const failed = stats.failed || 0;
    const pending = stats.pending || 0;
    const age = Math.floor((Date.now() - new Date(b.collectedDate)) / 86400000);
    const bNo = batchNoFromBatchCode(b.code);
    const bt = batchTheme(bNo);
    return React.createElement("div", {
      key: b.id,
      style: {
        ...C.card,
        background: bt.soft,
        borderColor: bt.border,
        cursor: "pointer"
      },
      onClick: () => setGridB(b)
    }, React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start"
      }
    }, React.createElement("div", null, React.createElement("div", {
      style: {
        fontSize: 20,
        fontWeight: 800,
        color: bt.color
      }
    }, b.code), React.createElement("div", {
      style: {
        color: "#475569",
        fontSize: 14,
        marginTop: 2
      }
    }, "Collected ", fmtDate(b.collectedDate), " \xB7 ", age, "d ago")), React.createElement("div", {
      style: {
        textAlign: "right"
      }
    }, React.createElement("div", {
      style: {
        fontSize: 26,
        fontWeight: 900,
        color: bt.color
      }
    }, b.eggCount), React.createElement("div", {
      style: {
        fontSize: 12,
        color: "#475569"
      }
    }, "eggs"), React.createElement("div", {
      style: {
        color: bt.color,
        fontSize: 13,
        fontWeight: 800,
        marginTop: 4
      }
    }, "Hatch ", fmtPct(hatched, b.eggCount), " · Fail ", fmtPct(failed, b.eggCount)))), b.notes && React.createElement("div", {
      style: {
        color: "#475569",
        marginTop: 8,
        fontSize: 14
      }
    }, b.notes), React.createElement("div", {
      style: C.div
    }), React.createElement("div", {
      style: {
        display: "flex",
        gap: 10,
        alignItems: "center",
        flexWrap: "wrap"
      }
    }, React.createElement("span", {
      style: {
        fontSize: 14,
        color: "#15803d",
        fontWeight: 700
      }
    }, "\uD83D\uDC23 ", hatched), React.createElement("span", {
      style: {
        fontSize: 14,
        color: "#b91c1c",
        fontWeight: 700
      }
    }, "\uD83D\uDC80 ", failed), React.createElement("span", {
      style: {
        fontSize: 14,
        color: "#475569"
      }
    }, "\uD83E\uDD5A ", pending), React.createElement("div", {
      style: {
        marginLeft: "auto",
        display: "flex",
        gap: 8
      }
    }, React.createElement("button", {
      style: bookmarkButtonStyle(!!b.bookmarked, {
        ...C.sm
      }),
      onClick: e => {
        e.stopPropagation();
        toggleBatchBookmark(b);
      }
    }, bookmarkButtonTheme(!!b.bookmarked).icon), React.createElement("button", {
      style: {
        ...C.sm,
        color: bt.color,
        borderColor: bt.border
      },
      onClick: e => {
        e.stopPropagation();
        setEf({
          date: b.collectedDate,
          count: String(b.eggCount),
          notes: b.notes || ""
        });
        setEditB(b);
      }
    }, "\u270E"), React.createElement("button", {
      style: C.del,
      onClick: e => {
        e.stopPropagation();
        onDelete(b.id);
      }
    }, "Delete"))));
  }), showNew && React.createElement(Modal, {
    title: "New Batch · " + newCode,
    onClose: () => setShowNew(false)
  }, React.createElement("div", {
    style: {
      color: "#475569",
      fontSize: 14,
      marginBottom: 4
    }
  }, form.count ? `Eggs: ${eggCode(newCode, 0)} → ${eggCode(newCode, +form.count - 1)}` : "Enter count to preview codes"), React.createElement(FL, {
    lbl: "Collection Date"
  }, React.createElement("input", {
    style: C.inp,
    type: "date",
    value: form.date,
    onChange: e => setForm({
      ...form,
      date: e.target.value
    })
  })), React.createElement(FL, {
    lbl: "Egg Count *"
  }, React.createElement("input", {
    style: C.inp,
    type: "number",
    value: form.count,
    onChange: e => setForm({
      ...form,
      count: e.target.value
    }),
    min: "1",
    placeholder: "e.g. 12"
  })), React.createElement(FL, {
    lbl: "Notes"
  }, React.createElement("textarea", {
    style: C.ta,
    value: form.notes,
    onChange: e => setForm({
      ...form,
      notes: e.target.value
    })
  })), React.createElement("button", {
    style: C.btn,
    onClick: saveBatch
  }, "Save Batch")), editB && React.createElement(Modal, {
    title: "Edit " + editB.code,
    onClose: () => setEditB(null)
  }, React.createElement(FL, {
    lbl: "Collection Date"
  }, React.createElement("input", {
    style: C.inp,
    type: "date",
    value: ef.date,
    onChange: e => setEf({
      ...ef,
      date: e.target.value
    })
  })), React.createElement(FL, {
    lbl: "Egg Count"
  }, React.createElement("input", {
    style: C.inp,
    type: "number",
    value: ef.count,
    onChange: e => setEf({
      ...ef,
      count: e.target.value
    }),
    min: "1"
  }), +ef.count < editB.eggCount && React.createElement("div", {
    style: {
      color: "#a16207",
      fontSize: 13,
      marginTop: 6
    }
  }, "\u26A0\uFE0F Reducing count hides eggs beyond the new number.")), React.createElement(FL, {
    lbl: "Notes"
  }, React.createElement("textarea", {
    style: C.ta,
    value: ef.notes,
    onChange: e => setEf({
      ...ef,
      notes: e.target.value
    })
  })), React.createElement("button", {
    style: C.btn,
    onClick: saveEdit
  }, "Save Changes")), gridB && React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "#000000b0",
      zIndex: 200,
      overflowY: "auto"
    }
  }, React.createElement("div", {
    style: {
      background: "#ffffff",
      border: "1px solid #d9e3ef",
      borderRadius: 18,
      margin: "16px 10px 90px",
      padding: 18
    }
  }, React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      marginBottom: 10
    }
  }, React.createElement("div", {
    style: {
      flex: 1
    }
  }, React.createElement("div", {
    style: {
      fontSize: 20,
      fontWeight: 900,
      color: "#b45309"
    }
  }, gridB.code), React.createElement("div", {
    style: {
      fontSize: 13,
      color: "#475569"
    }
  }, gridB.eggCount, " eggs \xB7 ", fmtDate(gridB.collectedDate))), React.createElement("button", {
    onClick: () => setGridB(null),
    style: C.sec
  }, "\u2715")), React.createElement("div", {
    style: {
      display: "flex",
      gap: 12,
      marginBottom: 12,
      fontSize: 13,
      flexWrap: "wrap"
    }
  }, React.createElement("span", {
    style: {
      color: "#475569",
      fontWeight: 700
    }
  }, "\uD83E\uDD5A Pending"), React.createElement("span", {
    style: {
      color: "#15803d",
      fontWeight: 700
    }
  }, "\uD83D\uDC23 Hatched"), React.createElement("span", {
    style: {
      color: "#b91c1c",
      fontWeight: 700
    }
  }, "\uD83D\uDC80 Failed")), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(5,1fr)",
      gap: 8
    }
  }, Array.from({
    length: gridB.eggCount
  }, (_, i) => {
    const code = eggCode(gridB.code, i);
    const st = eggStates.find(s => s.id === code);
    const isH = st?.status === "hatched";
    const isF = st?.status === "failed";
    return React.createElement("div", {
      key: code,
      onClick: () => tapEgg(code, gridB.id, i),
      style: {
        background: isH ? "#15803d18" : isF ? "#b91c1c18" : "#d9e3ef",
        border: isH ? "2px solid #15803d" : isF ? "2px solid #b91c1c" : "2px solid #c4d0df",
        borderRadius: 12,
        padding: "10px 4px 8px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
        cursor: st ? "default" : "pointer",
        userSelect: "none"
      }
    }, React.createElement("span", {
      style: {
        fontSize: 24
      }
    }, isH ? "🐣" : isF ? "💀" : "🥚"), React.createElement("span", {
      style: {
        fontSize: 9,
        color: isH ? "#15803d" : isF ? "#b91c1c" : "#475569",
        fontWeight: 700,
        textAlign: "center",
        wordBreak: "break-all"
      }
    }, code.split("-").slice(1).join("-")));
  })))), eggAct && React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "#000000c0",
      zIndex: 300,
      display: "flex",
      alignItems: "flex-end"
    }
  }, React.createElement("div", {
    style: {
      background: "#ffffff",
      border: "1px solid #d9e3ef",
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      width: "100%",
      padding: 20,
      paddingBottom: 36
    }
  }, React.createElement("div", {
    style: {
      textAlign: "center",
      marginBottom: 12
    }
  }, React.createElement("div", {
    style: {
      fontSize: 36
    }
  }, "\uD83E\uDD5A"), React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 900,
      color: "#b45309",
      marginTop: 4
    }
  }, eggAct.code), React.createElement("div", {
    style: {
      fontSize: 14,
      color: "#475569",
      marginTop: 2
    }
  }, "What happened to this egg?")), eggAct.mode === null && React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12
    }
  }, React.createElement("button", {
    onClick: () => setEggAct({
      ...eggAct,
      mode: "hatch"
    }),
    style: {
      background: "#15803d18",
      border: "2px solid #15803d55",
      borderRadius: 14,
      padding: "16px 8px",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8
    }
  }, React.createElement("span", {
    style: {
      fontSize: 32
    }
  }, "\uD83D\uDC23"), React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: "#15803d"
    }
  }, "Hatched \u2713")), React.createElement("button", {
    onClick: () => setEggAct({
      ...eggAct,
      mode: "fail"
    }),
    style: {
      background: "#b91c1c18",
      border: "2px solid #b91c1c55",
      borderRadius: 14,
      padding: "16px 8px",
      cursor: "pointer",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 8
    }
  }, React.createElement("span", {
    style: {
      fontSize: 32
    }
  }, "\uD83D\uDC80"), React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 800,
      color: "#b91c1c"
    }
  }, "Failed \u2717"))), eggAct.mode === "hatch" && React.createElement("div", null, React.createElement(FL, {
    lbl: "Hatch Date"
  }, React.createElement("input", {
    style: C.inp,
    type: "date",
    value: hf.hatchDate,
    onChange: e => setHf({
      ...hf,
      hatchDate: e.target.value
    })
  })), React.createElement(FL, {
    lbl: "Breed"
  }, React.createElement("input", {
    style: C.inp,
    value: hf.breed,
    onChange: e => setHf({
      ...hf,
      breed: e.target.value
    }),
    placeholder: "e.g. Rhode Island Red"
  })), React.createElement(FL, {
    lbl: "Sex"
  }, React.createElement("select", {
    style: C.sel,
    value: hf.sex,
    onChange: e => setHf({
      ...hf,
      sex: e.target.value
    })
  }, React.createElement("option", {
    value: "unknown"
  }, "unknown"), React.createElement("option", {
    value: "female"
  }, "female"), React.createElement("option", {
    value: "male"
  }, "male"))), React.createElement(FL, {
    lbl: "Notes"
  }, React.createElement("textarea", {
    style: C.ta,
    value: hf.notes,
    onChange: e => setHf({
      ...hf,
      notes: e.target.value
    })
  })), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginTop: 18
    }
  }, React.createElement("button", {
    style: C.sec,
    onClick: () => setEggAct({
      ...eggAct,
      mode: null
    })
  }, "\u2190 Back"), React.createElement("button", {
    style: {
      ...C.btn,
      marginTop: 0
    },
    onClick: doHatch
  }, "\uD83D\uDC23 Confirm"))), eggAct.mode === "fail" && React.createElement("div", null, React.createElement(FL, {
    lbl: "Reason"
  }, React.createElement("textarea", {
    style: C.ta,
    value: failNote,
    onChange: e => setFailNote(e.target.value),
    placeholder: "e.g. Infertile, cracked..."
  })), React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 10,
      marginTop: 18
    }
  }, React.createElement("button", {
    style: C.sec,
    onClick: () => setEggAct({
      ...eggAct,
      mode: null
    })
  }, "\u2190 Back"), React.createElement("button", {
    style: {
      background: "#b91c1c",
      color: "#eef3f9",
      border: "none",
      borderRadius: 12,
      padding: "15px",
      fontSize: 16,
      fontWeight: 800,
      cursor: "pointer"
    },
    onClick: doFail
  }, "\uD83D\uDC80 Mark Failed"))), React.createElement("button", {
    onClick: () => setEggAct(null),
    style: {
      ...C.sec,
      width: "100%",
      marginTop: 12
    }
  }, "Cancel"))));
}

    function shortText(value, max = 34) {
      const text = String(value || "").trim();
      return text.length > max ? `${text.slice(0, max - 1)}…` : text;
    }

    function logHistory(text, kind = "board") {
      if (!Array.isArray(state.history)) state.history = [];
      state.history.push({ at: new Date().toISOString(), text: String(text), kind, ...(IS_DEMO ? {} : { deviceId: deviceIdentity.id }) });
      if (state.history.length > 50) state.history.shift();
    }

    function pushUndoState(action = "board", detail = null) {
      const label = detail || (action in HISTORY_LABELS ? HISTORY_LABELS[action] : "Changed the board");
      lastPushLoggedHistory = Boolean(label);
      if (label) logHistory(label, action);
      undoStack.push(JSON.stringify(state));
      undoActions.push(action);
      if (undoStack.length > 40) {
        undoStack.shift();
        undoActions.shift();
      }
      lastUndoAction = undoActions[undoActions.length - 1] || null;
    }

    function discardUndoState() {
      undoStack.pop();
      undoActions.pop();
      lastUndoAction = undoActions[undoActions.length - 1] || null;
      if (lastPushLoggedHistory) {
        state.history.pop();
        lastPushLoggedHistory = false;
      }
    }

    function restoreUndoState() {
      const snapshot = undoStack.pop();
      if (!snapshot) return;
      undoActions.pop();
      lastUndoAction = undoActions[undoActions.length - 1] || null;
      const previousSelection = selectedNode;
      state = normalizeState(JSON.parse(snapshot));
      // Keep the user's place: only drop the selection when the restored state
      // no longer shows that node — never yank it to the top of the board.
      const visible = getVisibleNodes();
      selectedNode = (previousSelection
        && visible.find((node) => node.kind === previousSelection.kind && node.id === previousSelection.id))
        || null;
      multiSelectedNodes = selectedNode ? [{ ...selectedNode }] : [];
      selectionAnchorNode = selectedNode ? { ...selectedNode } : null;
      saveState();
      render();
    }

    function shouldUseBoardUndo(isEditingText = false) {
      return undoStack.length > 0 && (!isEditingText || lastUndoAction === "delete");
    }


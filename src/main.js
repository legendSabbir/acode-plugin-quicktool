import plugin from '../plugin.json';
import styles from './styles.scss';
const EditorFile = acode.require('EditorFile');
const fs = acode.require('fsOperation');
const Range = ace.require("ace/range").Range;
const { editor } = editorManager;
const keybinding_file_url = PLUGIN_DIR + "/" + plugin.id + "/keybindings.json";


const TAG = function (elem, { id, className, text, action }) {
  const $el = document.createElement(elem)
  if (id) { $el.id = id }
  if (className) { $el.className = className }
  if (text) { $el.textContent = text }
  if (action) { $el.dataset.action = action }
  return $el
}


class QuickTools {
  constructor() {
    this.commandFunction = this.$commandFunction.call(this);
    this.shiftFuncton = this.$shiftFuncton.call(this);
    this.find = this.$find.call(this);
    this.navigationFunction = this.navigationFunction.bind(this);
    this.exec = this.exec.bind(this);
    this.continuesExec = this.continuesExec.bind(this);
    
    this.commandState = "none";
    this.rangesStack = [];
    this.shiftActive = false;
    this.holdTimeout = null;
    this.navigationTimeout = null;
    this.continuesExecInterval = null;
    this.textInput = editor.textInput.getElement();
    this.textLayer = editor.renderer.$textLayer.element;
    
    this.container = TAG("section", { className: "quick-tools" });
    
    this.row1 = this.$row1.call(this);
    this.row2 = this.$row2.call(this);
    this.search_row1 = this.$searchRow1.call(this);
    this.search_row2 = this.$searchRow2.call(this);
    this.container.append(this.row1, this.row2);
    
    this.container.ontouchstart = this.onTouchStart.bind(this);
    this.container.ontouchend = this.onTouchEnd.bind(this);
  }
  
  
  $row1() {
    const row1 = TAG("div", { className: "row" });
    
    this.cmd_btn = TAG("button", { className: "cmd-btn", action: "cmd" });
    this.shift_btn = TAG("button", { className: "letters", action: "shift", text: "shft" });
    this.bracket_popup_toggle = TAG("button", { className: "popup-toggle", text: "()" });
    this.search_btn = TAG("button", { className: "icon search", action: "search" });
    this.save_btn = TAG("button", { className: "icon save", action: "save" });
    this.saveNoticeIcon.call(this);
    this.left_btn = TAG("button", { className: "letters", action: "word-left", text: "left" });
    this.right_btn = TAG("button", { className: "letters", action: "word-right", text: "rght" });
    this.string_popup_toggle = TAG("button", { className: "popup-toggle", text: '""' });
    
    const bracketPopup = this.buildPopup("bracket");
    const stringPopup = this.buildPopup("string");
    this.addEventOnPopup.call(this, this.bracket_popup_toggle, bracketPopup);
    this.addEventOnPopup.call(this, this.string_popup_toggle, stringPopup);
    this.container.append(bracketPopup, stringPopup);
    
    row1.append(
      this.cmd_btn,
      this.shift_btn,
      this.bracket_popup_toggle,
      this.search_btn,
      this.save_btn,
      this.left_btn,
      this.right_btn,
      this.string_popup_toggle
    );
    
    return row1
  }
  
  
  $row2() {
    const row2 = TAG("div", { className: "row" });
    
    this.backspace_btn = TAG("button", { className: "has-icon", action: "backspace" });
    this.undo_btn = TAG("button", { className: "icon undo", action: "undo" });
    this.redo_btn = TAG("button", { className: "icon redo", action: "redo" });
    this.arrow_left_btn = TAG("button", { className: "icon keyboard_arrow_left", action: "left" });
    this.arrow_right_btn = TAG("button", { className: "icon keyboard_arrow_right", action: "right" });
    this.home_btn = TAG("button", { className: "letters", action: "home", text: "home" });
    this.end_btn = TAG("button", { className: "letters", action: "end", text: "end" });
    this.tab_btn = TAG("button", { className: "icon keyboard_tab", action: "tab" });
    
    row2.append(
      this.backspace_btn,
      this.undo_btn,
      this.redo_btn,
      this.arrow_left_btn,
      this.arrow_right_btn,
      this.home_btn,
      this.end_btn,
      this.tab_btn
    );
    
    return row2
  }
  
  
  $searchRow1() {
    const search_row1 = TAG("div", { className: "row" });
    
    this.search_input = TAG("input", {});
    this.search_input.placeholder = "Search...";
    this.search_input.addEventListener("touchstart", (e) => e.stopPropagation());
    this.search_input.addEventListener("input", (e) => this.find(0, false, 500));
    this.search_prev = TAG("button", { className: "icon arrow_back", action: "prev" });
    this.search_next = TAG("button", { className: "icon arrow_forward", action: "next" });
    this.search_cancel_btn = TAG("button", { className: "has-icon", action: "search-cancel" });
    
    search_row1.append(
      this.search_input,
      this.search_prev,
      this.search_next,
      this.search_cancel_btn
    );
    
    return search_row1
  }
  
  
  $searchRow2() {
    const search_row2 = TAG("div", { className: "row" });
    
    this.replace_input = TAG("input", {});
    this.replace_input.placeholder = "Replace...";
    this.replace_input.addEventListener("touchstart", (e) => e.stopPropagation());
    this.replace_btn = TAG("button", { className: "icon replace", action: "replace" });
    this.replace_all_btn = TAG("button", { className: "icon replace_all", action: "replace-all" });
    const searchStatus = TAG("div", { className: "search-status" });
    this.current_search_pos = TAG("span", { className: "current-pos", text: "0" });
    const search_separator = TAG("span", { text: "of" });
    this.total_search_result = TAG("span", { className: "total-result", text: "0" });
    searchStatus.append(this.current_search_pos, search_separator, this.total_search_result);
    
    search_row2.append(
      this.replace_input,
      this.replace_btn,
      this.replace_all_btn,
      searchStatus
    );
    
    return search_row2
  }
  
  
  buildPopup(type) {
    const popup = TAG("div", { className: "popup-container" });
    if (type === "bracket")
      popup.style = "left: 45px; right: 49px;"
    else
      popup.style = "right: 5px; left: 89px";
    
    let popupItems = [];
    
    if (type === "bracket") {
      popupItems = [
        [")"], ["}"], ["]"], ["]"], ["+"], ["\\"],
        ["()", true], ["{}", true], ["[]", true], ["=> "], ["<>", true], ["/"]
      ];
    } else {
      popupItems = [
        ["?"], ["@"], ['$'], ["%"], ["``", true], ["''", true],
        ["_"], ["-"],["= "], [': '], [";"], ['""', true]
      ]
    }
    
    popupItems.forEach(item => {
      const $popupBtn = TAG("div", { className: "popup-btn", text: item[0].trim() });
      $popupBtn.dataset.key = item[0];
      if (item[1]) $popupBtn.dataset.selection = "true";
      popup.append($popupBtn);
    });
    
    return popup
  }
  
  
  addEventOnPopup($toggler, popup) {
    let popupTimeoutID = null
    let lastActive = null
    
    $toggler.ontouchstart = function(e) {
      e.preventDefault();
      $toggler.classList.add("active");
      popupTimeoutID = setTimeout(() => {
        $toggler.classList.remove("active");
        popup.classList.add("active");
      }, 100)
    }
    
    $toggler.ontouchmove = function(e) {
      const rect = popup.getBoundingClientRect();
      const { clientX, clientY } = e.touches[0];
      const pointX = Math.min(Math.max(rect.left + 10, clientX), rect.right - 10);
      const pointY = Math.min(Math.max(rect.top + 10, clientY), rect.bottom - 10);
      
      lastActive?.classList.remove("hover");
      const elementInHoverPosition = document.elementFromPoint(pointX, pointY);
      if (elementInHoverPosition) {
        elementInHoverPosition.classList.add("hover")
        lastActive = elementInHoverPosition
      }
    }
    
    $toggler.ontouchend = () => {
      clearTimeout(popupTimeoutID);
      $toggler.classList.remove("active");
      popup.classList.remove("active");
      
      const hoverElement = popup.querySelector(".hover");
      if (hoverElement) {
        hoverElement.classList.remove("hover");
        const textToInsert = hoverElement.dataset.key;
        const selection = hoverElement.dataset.selection;
        
        if (selection) {
          if (!editor.selection.isEmpty()) {
            editor.insert(`${textToInsert[0]}${editor.getSelectedText()}${textToInsert[1]}`);
          } else {
            editor.insert(textToInsert, { overwrite: true });
            editor.execCommand("gotoleft");
          }
        } else {
          editor.insert(textToInsert, { overwrite: true });
        }
      } else {
        const textToInsert = $toggler.textContent.trim();
        editor.insert(textToInsert);
        if (textToInsert.length == 2)
          editor.execCommand("gotoleft");
      }
    }
  }
  
  
  onTouchStart(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const target = e.target.closest("[data-action]")
    if (!target) return;
    
    target.classList.add("active");
    
    switch(target.dataset.action) {
      case "cmd":
        this.commandFunction();
        break;
      case "shift":
        this.shiftFuncton();
        break;
      case "search":
        this.toggleSearchRow.call(this, true);
        break;
      case "search-cancel":
        this.toggleSearchRow.call(this, false);
        break;
      case "prev":
        this.find(1, true);
        break;
      case "next":
        this.find(1, false);
        break;
      case "replace":
        editor.replace(this.replace_input.value || "");
        break;
      case "replace-all":
        editor.replaceAll(this.replace_input.value || "");
        break;
      case "save":
        editor.execCommand("saveFile");
        break;
      case "word-left":
        this.leftRightBtn.call(this, "left");
        break;
      case "word-right":
        this.leftRightBtn.call(this, "right");
        break;
      case "undo":
        this.undo.call(this);
        break;
      case "redo":
        editor.execCommand("redo");
        break;
      case "backspace":
        this.navigationFunction(8, 50);
        break;
      case "left":
        this.navigationFunction(37);
        break;
      case "right":
        this.navigationFunction(39);
        break;
      case "end":
        this.homeEndFunction.call(this, "end");
        break;
      case "home":
        this.homeEndFunction.call(this, "home");
        break;
      case "tab":
        this.tabFunction(9);
        break;
    }
  }
  
  
  onTouchEnd(e) {
    clearTimeout(this.holdTimeout);
    clearTimeout(this.navigationTimeout);
    clearInterval(this.continuesExecInterval);
    this.container.querySelector(".row .active")?.classList.remove("active");
  }
  
  
  $commandFunction() {
    let touchStartTime = 0;
    let commandsObj = Object.create(null);
    let isScrolling = false
    const hideTeardrop = TAG("style", { className: "hide-teardrop", text: `.ace_editor .cursor.single { display: none!important }` });
    
    const readKeybindingFile = async () => {
      const keybindingsFileData = await fs(keybinding_file_url).readFile("utf8");
      const keybindings = JSON.parse(keybindingsFileData);
      return keybindings
    }
    
    const editKeybindingFile = () => {
      const file = new EditorFile("keybindings.json", {
        uri: keybinding_file_url
      })
      file.render();
      setTimeout(() => {
        editor.execCommand("gotoend");
        editor.focus();
      }, 300)
    }
    
    const updatekeybindingFile = async () => {
      let update = false
      const keybindings = await readKeybindingFile();
      const allCommands = Object.keys(editor.commands.commands)
      
      for (const command of allCommands) {
        if (!keybindings.hasOwnProperty(command)) {
          keybindings[command] = ""
          update = true
        }
      }
      
      if (update) {
        await fs(keybinding_file_url).writeFile(JSON.stringify(keybindings, null, 2))
        window.toast("Updated 😁", 2000);
        editKeybindingFile();
      } else {
        window.toast("No new Command found", 2000)
      }
    }
    
    (async () => {
      const keybindings = await readKeybindingFile();
      Object.entries(keybindings)
        .filter(([cmd, key]) => key !== "")
        .forEach(([cmd, key]) => commandsObj[key] = cmd);
    })();
    
    
    editor.commands.addCommand({
      name: "editKeybindingFile",
      description: "Edit keybinding File (cmd)",
      exec: editKeybindingFile,
    });
    
    editor.commands.addCommand({
      name: "updatekeybindingFile",
      description: "Update keybinding File",
      exec: updatekeybindingFile
    });
    
    
    const resetCommandState = () => {
      this.cmd_btn.removeAttribute("data-state");
      if (this.commandState === "hold") removeHoldEvents();
      this.commandState = "none";
      delete editor.onTextInput
    }
    
    const execCommand = (e) => {
      if (e.data === " ") return
      
      if (e.inputType === "insertText")
        editor.execCommand(commandsObj[e.data]);
      else if (e.inputType === "insertLineBreak")
        editor.execCommand("addLineAfter");
    }
    
    const singleClick = () => {
      if (this.commandState === "none") {
        this.cmd_btn.setAttribute("data-state", "single");
        this.commandState = "single";
        editor.onTextInput = function() {
          execCommand(event);
          setTimeout(resetCommandState);
        }
      } else {
        resetCommandState();
      }
    }
    
    const doubleClick = () => {
      this.cmd_btn.setAttribute("data-state", "double");
      this.commandState = "double";
      editor.onTextInput = function() {
        execCommand(event);
      }
    }
    
    const touchStart = () => { isScrolling = false }
    
    const touchMove = () => { isScrolling = true }
    
    const touchEnd = (e) => {
      if (isScrolling) return
      
      const pos = editor.renderer.screenToTextCoordinates(e.changedTouches[0].pageX, e.changedTouches[0].pageY);
      const range = new Range(pos.row, pos.column, pos.row, pos.column);
      editor.selection.addRange(range);
      const isExist = this.rangesStack.some(r => (r.start.row === range.start.row && r.start.column === range.start.column));
      if (!isExist)
        this.rangesStack.unshift(range);
    }
    
    const addHoldEvents = () => {
      if (!this.shiftActive)
        this.textLayer.style.pointerEvents = "all";
      else 
        editor.execCommand("toggleShiftButton");
      
      editor.clearSelection();
      const allRanges = editor.selection.getAllRanges();
      this.rangesStack.unshift(...allRanges);
      
      editor.focus();
      this.textLayer.addEventListener("touchstart", touchStart);
      this.textLayer.addEventListener("touchmove", touchMove);
      this.textLayer.addEventListener("touchend", touchEnd);
      document.head.append(hideTeardrop);
    }
    
    const removeHoldEvents = () => {
      if (!this.shiftActive)
        this.textLayer.style.pointerEvents = "none";
      
      this.rangesStack.splice(0);
      this.textLayer.removeEventListener("touchstart", touchStart);
      this.textLayer.removeEventListener("touchmove", touchMove);
      this.textLayer.removeEventListener("touchend", touchEnd);
      hideTeardrop.remove();
    }
    
    const hold = () => {
      delete editor.onTextInput
      this.cmd_btn.setAttribute("data-state", "hold");
      this.commandState = "hold";
      addHoldEvents();
    }
    
    
    editor.commands.addCommand({
      name: "toggleCommandButton",
      description: "Toggle Command Button",
      exec: resetCommandState
    });
    
    return () => {
      this.cmd_btn.classList.remove("active");
      const state = this.commandState;
      
      if (state === "hold" || state === "double") {
        resetCommandState();
      } else {
        if ((Date.now() - touchStartTime) < 300) {
          doubleClick();
        } else {
          touchStartTime = Date.now();
          singleClick();
          this.holdTimeout = setTimeout(hold, 400);
        }
      }
    }
  }
  
  
  $shiftFuncton() {
    let anchor
    let cursorPos
    let shiftTimeout = null
    let shiftTouchStart = false
    
    function touchStart(e) {
      shiftTouchStart = true
      cursorPos = editor.renderer.screenToTextCoordinates(e.touches[0].pageX, e.touches[0].pageY);
      clearTimeout(shiftTimeout);
      shiftTimeout = setTimeout(() => {
        shiftTouchStart = false
      }, 100)
    }
    
    function changeSelection() {
      if (!shiftTouchStart) return
      
      const selection = editor.selection.getAllRanges();
      if (selection.length > 1) {
        editor.selection.clearSelection()
        setTimeout(() => editor.selection.setRange({ start: anchor, end: cursorPos }));
      } else {
        editor.selection.setRange({ start: anchor, end: cursorPos });
      }
    }
    
    const addShiftEvents = () => {
      this.shift_btn.setAttribute("data-active", "");
      this.shiftActive = true;
      
      if (this.commandState !== "hold")
        this.textLayer.style.pointerEvents = "all";
      else
        editor.execCommand("toggleCommandButton");
      
      anchor = editor.selection.getSelectionAnchor() || editor.getCursorPosition();
      this.textLayer.addEventListener("touchstart", touchStart);
      editor.on("changeSelection", changeSelection);
    }
    
    const removeShiftEvents = () => {
      this.shift_btn.removeAttribute("data-active");
      this.shiftActive = false;
      
      if (this.commandState !== "hold")
        this.textLayer.style.pointerEvents = "none";
      editor.off("changeSelection", changeSelection);
      this.textLayer.removeEventListener("touchstart", touchStart);
    }
    
    editor.commands.addCommand({
      name: "toggleShiftButton",
      description: "Toggle Shift Button",
      exec: removeShiftEvents
    });
    
    return () => {
      if (!this.shiftActive)
        addShiftEvents();
      else 
        removeShiftEvents();
    }
  }
  
  
  toggleSearchRow(searchrow) {
    if (searchrow) {
      this.row1.remove();
      this.row2.remove();
      this.search_btn.classList.remove("active");
      this.container.append(this.search_row1, this.search_row2);
      this.search_input.focus();
      if (!editor.selection.isEmpty()) {
        const selectedText = editor.getSelectedText();
        this.search_input.value = selectedText;
        this.search_input.select();
      }
      this.find(0, false);
    } else {
      this.search_row1.remove();
      this.search_row2.remove();
      this.search_input.value = "";
      this.search_cancel_btn.classList.remove("active");
      this.container.append(this.row1, this.row2);
      editor.focus();
    }
  }
  
  
  $find() {
    let updateTimeout = null
    
    const updateSearchState = () => {
      const MAX_COUNT = 999;
      let regex = editor.$search.$options.re;
      let all = 0;
      let before = 0;
      if (regex) {
        const value = editor.session.getDocument().getValue();
        const offset = editor.session.doc.positionToIndex(
          editor.selection.anchor,
        );
        let last = (regex.lastIndex = 0);
        let m;
        while ((m = regex.exec(value))) {
          all++;
          last = m.index;
          if (last <= offset) before++;
          if (all > MAX_COUNT) break;
          if (!m[0]) {
            regex.lastIndex = last += 1;
            if (last >= value.length) break;
          }
        }
      }
      
      this.current_search_pos.textContent = before
      this.total_search_result.textContent = all > MAX_COUNT ? '999+' : all
    }
    
    return (skip, backwards, ms = 30) => {
      const value = this.search_input.value
      if (value.length >= 1) {
        editor.find(value, {
          skipCurrent: skip,
          backwards: backwards
        });
        clearTimeout(updateTimeout);
        updateTimeout = setTimeout(updateSearchState, ms);
      } else {
        clearTimeout(updateTimeout);
        this.current_search_pos.textContent = "0";
        this.total_search_result.textContent = "0";
      }
    }
  }
  
  
  saveNoticeIcon() {
    const toggleSaveIcon = () => {
      if (editorManager.activeFile?.isUnsaved) {
        this.save_btn.classList.add("notice")
      } else {
        this.save_btn.classList.remove("notice")
      }
    }
    
    editorManager.on('file-content-changed', toggleSaveIcon);
    editorManager.on('switch-file', toggleSaveIcon);
    editorManager.on('save-file', toggleSaveIcon);
  }
  
  
  leftRightBtn(where) {
    if (this.commandState !== "single" && this.commandState !== "double") {
      if (this.shiftActive)
        editor.execCommand("selectword" + where);
      else
        editor.execCommand("gotoword" + where);
    } else {
      if (where === "left")
        editor.execCommand("selectMoreBefore");
      else
        editor.execCommand("selectMoreAfter");
    }
  }
  
  
  undo() {
    if (this.rangesStack.length === 0) {
      editor.execCommand("undo");
      return
    } else if (this.rangesStack.length === 2) {
      this.rangesStack.shift();
      editor.selection.moveToPosition(this.rangesStack[0].start);
      return
    }
    
    this.rangesStack.shift();
    editor.selection.clearSelection();
    for (let i = 0; i < this.rangesStack.length; i++) {
      editor.selection.addRange(this.rangesStack[i]);
    }
    editor.selection.addRange(this.rangesStack[0]);
  }
  
  
  navigationFunction(key, ms = 20) {
    this.exec(key)
    this.navigationTimeout = setTimeout(() => this.continuesExec(key, ms), 300);
  }
  
  
  exec(key) {
    this.textInput.dispatchEvent(new KeyboardEvent("keydown", { keyCode: key, shiftKey: this.shiftActive }))
  }
  
  
  continuesExec(key, ms) {
    this.continuesExecInterval = setInterval(() => {
      this.exec(key)
    }, ms)
  }
  
  
  homeEndFunction(goto) {
    if (editor.completer?.activated) {
      const key = goto === "home" ? 38 : 40;
      this.continuesExec(key, 100);
    } else {
      if (goto == "home")
        this.exec(36);
      else
        this.navigationFunction(35);
    }
  }
  
  
  tabFunction(key) {
    if (editor.completer?.activated)
      editor.completer.detach();
    this.exec(key);
  }
}


function INIT() {
  const style_tag = TAG("style", { id: "quick-tools-styles", text: styles });
  document.head.append(style_tag);
  
  const root = document.querySelector("#root")
  if (root) setTimeout(() => root.setAttribute("footer-height", "2"), 3000);

  const quickTools = new QuickTools();
  document.body.append(quickTools.container);
}


function DESTROY() {
  
}


// try{

if (window.acode) {
  acode.setPluginInit(plugin.id, INIT);
  acode.setPluginUnmount(plugin.id, DESTROY);
}

// }catch(err) { setTimeout(() => {console.log(err)}, 3000) }
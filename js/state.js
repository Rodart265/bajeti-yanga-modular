// ===============================================
// state.js
// ===============================================
// In the single-file version, things like `lang`, `hhId`, `lCfg` were
// separate `let` variables sitting at the top of the script, and every
// function in the file could see and change them directly because they
// all lived in the same script block.
//
// Split into separate files, that trick stops working — a plain `let`
// in one file is private to that file. To get the same "everyone can
// read and change it" behaviour, we put all the shared values as
// PROPERTIES of one object called `State`, and export that object.
//
// Any file that does:
//   import { State } from './state.js';
//   State.hhId = 'abc123';
// is changing the *same* object every other file is looking at — so
// the change is visible everywhere immediately. Think of `State` as
// one shared notebook that every file is allowed to read from and
// write in.
//
// A few variables from the original code (like the search-debounce
// timer, or the memoised totals cache) are NOT in here. Those are only
// ever touched by one specific file, so they're better off staying as
// a private `let` inside that one file — no need to put everything in
// the shared notebook, only the things multiple files actually need.

import { DEF_CFG } from './constants.js';

export const State = {
  // -- language + auth/session --
  lang: localStorage.getItem('nb_lang') || 'en',
  curUser: null,
  hhId: null,
  unsub: null,
  unsubHH: null,
  authReg: false,

  // -- the household's data, synced live from Firestore --
  lCfg: JSON.parse(JSON.stringify(DEF_CFG)),
  lPx: [],
  lHHDoc: {},

  // -- which screen / tab is showing, and its filters --
  tab: 'home',
  insTab: 'summary',
  selItem: null,
  fUser: 'all',
  logSrch: '',
  sortMode: 'cat',
  srchQ: '',
  logType: 'expense',
  histFilter: 'all',
  histTime: 'month',
  viewMonth: null,

  // -- PIN lock flow --
  pinEntry: '',
  pinMode: 'check',
  pinTmp: '',

  // -- phone OTP / auth helpers --
  confResult: null,
  rcapV: null,
  _pendingHid: null,
  _resendCooldown: 0,

  // -- Bajeti AI chat --
  chatHistory: [],
  chatConversations: [],
  activeChatId: null,
  chatBusy: false,
  _aiInFlight: false,

  // -- Magic Log (paste-text-to-extract-items) --
  pendingMagicTxs: [],
  customCat: 'Other'
};


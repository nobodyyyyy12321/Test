export type SupportedUILanguage =
  | "zh-TW"
  | "zh-CN"
  | "en"
  | "es"
  | "th"
  | "id"
  | "ko"
  | "ru";

const profileZhTW = {
  tabProfile: "個人檔案",
  tabLists: "個人分類",
  tabShared: "分享給我",
  tabRecord: "紀錄",
  tabGroups: "群組",
  tabFollowers: "追蹤者",
  tabFollowing: "追蹤中",

  signOut: "登出",
  follow: "追蹤",
  followed: "已追蹤",
  unfollow: "取消追蹤",
  block: "封鎖",
  unblock: "解除封鎖",
  moreOptions: "更多選項",

  displayName: "顯示名稱",
  email: "Email",
  bio: "自我介紹",
  socialLinks: "社群連結",
  changeAvatar: "更換頭像",
  edit: "編輯",
  save: "儲存",
  saving: "儲存中...",
  cancel: "取消",
  notSet: "未設定",
  notSetYet: "尚未設定",
  publicEmail: "公開電子郵件",
  avatarUploadFailed: "頭像上傳失敗",
  imageTooLarge: "圖片過大，請選擇 15MB 以下檔案",
  saveFailed: "儲存失敗",

  recordHint: "保留最近十筆測驗紀錄",
  loading: "載入中...",
  noRecords: "尚無紀錄",
  recitationSuccess: "✓ 成功",
  recitationFail: "✗ 失敗",

  noFollowers: "尚無追蹤者",
  noFollowing: "尚無追蹤中的使用者",
  noBlocked: "尚無封鎖帳號",
  unblocking: "解封中...",

  pendingInvites: "待接受邀請",
  accept: "接受",
  groupNamePlaceholder: "新增群組名稱",
  create: "建立",
  myGroups: "我建立的群組",
  joinedGroups: "加入的群組",
  noGroups: "尚無群組",
  groupMembers: "成員",
  noMembers: "尚無成員",
  pendingAccept: "待接受",
  remove: "移除",
  inviteMember: "邀請成員",
  searchAccountPlaceholder: "搜尋帳號名稱",
  searching: "搜尋中...",
  noUserFound: "找不到使用者",
  alreadyInGroup: "已在群組",
  invited: "已邀請",
  invite: "邀請",
  shareListToGroup: "分享試卷給全群組",
  selectList: "選擇試卷",
  share: "分享",
  shareFailed: "分享失敗",
  deleteGroup: "刪除群組",
  leaveGroup: "離開群組",
  groupOwner: "群主",
  membersCountSuffix: "位成員",
  sharedCountSuffix: "位成員",

  sharedWithMeEmpty: "尚無分享項目",
  removeFromHome: "從首頁移除",
  showOnHome: "顯示在首頁",
};

export type ProfileTextKey = keyof typeof profileZhTW;
type ProfileDictionary = Record<ProfileTextKey, string>;

const profileEn: ProfileDictionary = {
  tabProfile: "Profile",
  tabLists: "Personal Categories",
  tabShared: "Shared with Me",
  tabRecord: "Records",
  tabGroups: "Groups",
  tabFollowers: "Followers",
  tabFollowing: "Following",

  signOut: "Sign Out",
  follow: "Follow",
  followed: "Following",
  unfollow: "Unfollow",
  block: "Block",
  unblock: "Unblock",
  moreOptions: "More Options",

  displayName: "Display Name",
  email: "Email",
  bio: "Bio",
  socialLinks: "Social Links",
  changeAvatar: "Change Avatar",
  edit: "Edit",
  save: "Save",
  saving: "Saving...",
  cancel: "Cancel",
  notSet: "Not set",
  notSetYet: "Not set yet",
  publicEmail: "Make email public",
  avatarUploadFailed: "Avatar upload failed",
  imageTooLarge: "Image too large. Please choose a file under 15MB.",
  saveFailed: "Save failed",

  recordHint: "Keep the latest 10 quiz records",
  loading: "Loading...",
  noRecords: "No records yet",
  recitationSuccess: "✓ Success",
  recitationFail: "✗ Failed",

  noFollowers: "No followers yet",
  noFollowing: "Not following anyone yet",
  noBlocked: "No blocked accounts",
  unblocking: "Unblocking...",

  pendingInvites: "Pending Invites",
  accept: "Accept",
  groupNamePlaceholder: "New group name",
  create: "Create",
  myGroups: "Groups I Created",
  joinedGroups: "Groups I Joined",
  noGroups: "No groups yet",
  groupMembers: "Members",
  noMembers: "No members yet",
  pendingAccept: "Pending",
  remove: "Remove",
  inviteMember: "Invite Members",
  searchAccountPlaceholder: "Search account name",
  searching: "Searching...",
  noUserFound: "No users found",
  alreadyInGroup: "Already in group",
  invited: "Invited",
  invite: "Invite",
  shareListToGroup: "Share list with group",
  selectList: "Select a list",
  share: "Share",
  shareFailed: "Share failed",
  deleteGroup: "Delete Group",
  leaveGroup: "Leave Group",
  groupOwner: "Owner",
  membersCountSuffix: "members",
  sharedCountSuffix: "members",

  sharedWithMeEmpty: "No shared items",
  removeFromHome: "Remove from Home",
  showOnHome: "Show on Home",
};

const PROFILE_TEXTS: Record<"zh-TW" | "en", ProfileDictionary> = {
  "zh-TW": profileZhTW,
  en: profileEn,
};

export function normalizeProfileLanguage(lang?: string | null): "zh-TW" | "en" {
  if (!lang) return "zh-TW";
  if (lang === "en") return "en";
  return "zh-TW";
}

export function getProfileText(lang: string | null | undefined, key: ProfileTextKey): string {
  const normalized = normalizeProfileLanguage(lang);
  return PROFILE_TEXTS[normalized][key];
}

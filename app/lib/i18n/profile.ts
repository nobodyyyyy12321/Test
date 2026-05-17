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
  tabRecord: "紀錄",
  tabGroups: "群組",
  tabFollowers: "追蹤者",
  tabFollowing: "追蹤中",
  tabGallery: "圖片庫",

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
  deleteGroup: "刪除群組",
  leaveGroup: "離開群組",
  groupOwner: "群主",
  membersCountSuffix: "位成員",

  removeFromHome: "從首頁移除",
  showOnHome: "顯示在首頁",
};

export type ProfileTextKey = keyof typeof profileZhTW;
type ProfileDictionary = Record<ProfileTextKey, string>;

const profileEn: ProfileDictionary = {
  tabProfile: "Profile",
  tabLists: "Personal Categories",
  tabRecord: "Records",
  tabGroups: "Groups",
  tabFollowers: "Followers",
  tabFollowing: "Following",
  tabGallery: "Image Gallery",

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
  deleteGroup: "Delete Group",
  leaveGroup: "Leave Group",
  groupOwner: "Owner",
  membersCountSuffix: "members",

  removeFromHome: "Remove from Home",
  showOnHome: "Show on Home",
};

const profileZhCN: ProfileDictionary = {
  tabProfile: "个人档案",
  tabLists: "个人分类",
  tabRecord: "记录",
  tabGroups: "群组",
  tabFollowers: "关注者",
  tabFollowing: "关注中",
  tabGallery: "图片库",

  signOut: "登出",
  follow: "关注",
  followed: "已关注",
  unfollow: "取消关注",
  block: "屏蔽",
  unblock: "解除屏蔽",
  moreOptions: "更多选项",

  displayName: "显示名称",
  email: "Email",
  bio: "个人简介",
  socialLinks: "社交链接",
  changeAvatar: "更换头像",
  edit: "编辑",
  save: "保存",
  saving: "保存中...",
  cancel: "取消",
  notSet: "未设置",
  notSetYet: "尚未设置",
  publicEmail: "公开电子邮件",
  avatarUploadFailed: "头像上传失败",
  imageTooLarge: "图片过大，请选择 15MB 以下文件",
  saveFailed: "保存失败",

  recordHint: "保留最近十笔测验记录",
  loading: "加载中...",
  noRecords: "暂无记录",
  recitationSuccess: "✓ 成功",
  recitationFail: "✗ 失败",

  noFollowers: "暂无关注者",
  noFollowing: "暂无正在关注的用户",
  noBlocked: "暂无屏蔽账号",
  unblocking: "解除中...",

  pendingInvites: "待接受邀请",
  accept: "接受",
  groupNamePlaceholder: "新增群组名称",
  create: "建立",
  myGroups: "我建立的群组",
  joinedGroups: "加入的群组",
  noGroups: "暂无群组",
  groupMembers: "成员",
  noMembers: "暂无成员",
  pendingAccept: "待接受",
  remove: "移除",
  inviteMember: "邀请成员",
  searchAccountPlaceholder: "搜索账号名称",
  searching: "搜索中...",
  noUserFound: "找不到用户",
  alreadyInGroup: "已在群组",
  invited: "已邀请",
  invite: "邀请",
  deleteGroup: "删除群组",
  leaveGroup: "离开群组",
  groupOwner: "群主",
  membersCountSuffix: "位成员",

  removeFromHome: "从首页移除",
  showOnHome: "显示在首页",
};

const PROFILE_TEXTS: Record<"zh-TW" | "zh-CN" | "en", ProfileDictionary> = {
  "zh-TW": profileZhTW,
  "zh-CN": profileZhCN,
  en: profileEn,
};

export function normalizeProfileLanguage(lang?: string | null): "zh-TW" | "zh-CN" | "en" {
  if (!lang) return "zh-TW";
  if (lang === "en") return "en";
  if (lang === "zh-CN") return "zh-CN";
  return "zh-TW";
}

export function getProfileText(lang: string | null | undefined, key: ProfileTextKey): string {
  const normalized = normalizeProfileLanguage(lang);
  return PROFILE_TEXTS[normalized][key];
}

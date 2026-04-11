const zhTW = [
  { "name": "背東西",
    "children":[
      { "name": "漢", "href": "/recitation/漢" },
      { "name": "唐", "href": "/recitation/唐" },
      { "name": "宋", "href": "/recitation/宋" },
      { "name": "明", "href": "/recitation/明" },
      { "name": "清", "href": "/recitation/清" },
      { "name": "民", "href": "/recitation/民" }
     ]
  },
  { "name": "國文", "children": [
    { "name": "學測", "dropdown": Array.from({ length: 115 - 83 + 1 }, (_, i) => ({ name: String(115 - i), href: "/under-construction" })) }
  ] },
  {
    "name": "英文",
    "children": [
      { "name": "2000單", "href": "/test1/englishWords?levels=1,2" },
      { "name": "4000單", "href": "/test1/englishWords?levels=3,4" },
      { "name": "6000單", "href": "/test1/englishWords?levels=5,6" },
      { "name": "學測", "href":"/under-construction"}
    ]
  },
  { "name": "公職考試", "href": "/under-construction" },
  { "name": "名言佳句", "href": "/test1/quoteChinese" },
  { "name": "綜合", "href": "/under-construction" },
  { "name": "比賽", "href": "/under-construction" },
  { "name": "八卦", "href": "/under-construction" },
  { "name": "猜謎", "href": "/under-construction" },
  { "name": "笑話", "href": "/under-construction" },
  { "name": "數學", "href": "/under-construction" },
  { "name": "物理", "href": "/under-construction" },
  { "name": "化學", "href": "/under-construction" },
  { "name": "生物", "href": "/under-construction" },
  { "name": "地理", "href": "/under-construction" },
  { "name": "天文", "href": "/under-construction" },
  { "name": "歷史", "href": "/under-construction" },
  { "name": "公民", "href": "/under-construction" },
  { "name": "心理", "href": "/under-construction" },
  { "name": "哲學", "href": "/under-construction" },
  { "name": "自然", "href": "/under-construction" },
  { "name": "社會", "href": "/under-construction" }
];

export default zhTW;

let aa
aa = /(?:^\s*(create)\s+\s+)/i
aa = /(?:^\s*(create)\s+((unique\s+)?view)\s+)/i
aa = /(?:^\s*(create(?:\s+or\s+replace)?)\s+((unique\s+)?view)\s+)(['"`]?)(\w+)\4/i

aa = /(?:^\s*(create(?:\s+or\s+replace)?)\s+((unique\s+)?type|user|view)\s+)(['"`]?)(\w+)\4/i
aa =
  /(?:^\s*(create(?:\s+or\s+replace)?)\s+((unique\s+)?index|language|operator class|operator|rule|schema|sequence|table|tablespace|trigger|type|user|view)\s+)(['"`]?)(\w+)\4/i
aa =
  /(?:^\s*(create(?:\s+or\s+replace)?)\s+(aggregate|conversion|database|domain|function|group|(unique\s+)?index|language|operator class|operator|rule|schema|sequence|table|tablespace|trigger|type|user|view)\s+)(['"`]?)(\w+)\4/i

new RegExp(
  '(?:^\\s*(create(?:\\s+or\\s+replace)?)\\s+(aggregate|conversion|database|domain|function|group|(unique\\s+)?index|language|operator class|operator|rule|schema|sequence|table|tablespace|trigger|type|user|view)\\s+)([\'"`]?)(\\w+)\\4',
  'i'
)

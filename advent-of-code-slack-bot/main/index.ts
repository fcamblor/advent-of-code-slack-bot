import Spreadsheet = GoogleAppsScript.Spreadsheet.Spreadsheet;
import Sheet = GoogleAppsScript.Spreadsheet.Sheet;

const PROPS = {
  SLACK_ACCESS_TOKEN: PropertiesService.getScriptProperties().getProperty('SLACK_ACCESS_TOKEN'),
  LOG_ENABLED: PropertiesService.getScriptProperties().getProperty('LOG_ENABLED'),
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'),
  SLACK_CHALLENGE_ACTIVATED: PropertiesService.getScriptProperties().getProperty('SLACK_CHALLENGE_ACTIVATED'),
  ADVENT_OF_CODE_PRIVATE_LEARDERBOARD_CODE: PropertiesService.getScriptProperties().getProperty('ADVENT_OF_CODE_PRIVATE_LEARDERBOARD_CODE'),
  ADVENT_OF_CODE_SESSION_COOKIE: PropertiesService.getScriptProperties().getProperty('ADVENT_OF_CODE_SESSION_COOKIE')
};

const CURRENT_YEAR = new Date().getUTCFullYear();

interface SlackEvent {
  text: string;
  type: string;
}

interface BotResettedEvent extends SlackEvent {
  bot_id: string;
}
interface ReactionEvent extends SlackEvent {
  user: string;
  item_user: string;
  item: {
    type: string;
    channel: string;
    ts: string;
  }
  reaction: string;
  event_ts: string;
}
interface ChannelMessageEvent extends SlackEvent {
  channel: string;
  user: string;
  thread_ts?: string;
  client_msg_id: string;
  ts: string;
  team: string;
  "blocks": {
    type: string;
    block_id: string;
    elements: any[]
  }[];
  parent_user_id: string;
  event_ts: string;
  channel_type: string;
}

interface MessageInfos {
  threadId: string;
  threadAuthorId: string;
  text: string;
}

type AdventDays = "1"|"2"|"3"|"4"|"5"|"6"|"7"|"8"|"9"|"10"|"11"|"12"|"13"|"14"|"15"|"16"|"17"|"18"|"19"|"20"|"21"|"22"|"23"|"24"|"25";
const SILVER_STAR = "1";
const GOLD_STAR = "2";
type DayStars = (typeof SILVER_STAR)|(typeof GOLD_STAR);

type LeaderboardAttrs = {
  event: number,
  owner_id: number,
  members: Record<string, MemberStatsAttrs>;
};

type MemberStatsAttrs = {
  id: string;
  name: string;
  global_score: number;
  local_score: number;
  stars: number;
  last_star_ts: number;
  completion_day_level: Record<AdventDays,CompletionStarsAttrs>
};

type CompletionStarsAttrs = Record<DayStars, {
  get_star_ts: string;
}>

type Member = {
  id: string;
  name: string;
  score: number;
  gold_stars: string;
  gold_stars_count: number;
  silver_stars: string;
  silver_stars_count: number;
  last_star_ts: number;
};

class Leaderboard {
  constructor(public readonly attrs: LeaderboardAttrs) {
  }

  sortedMembers(): Member[] {
    return Object.keys(this.attrs.members)
        .map(k => this.attrs.members[k])
        .sort((m1, m2) => m2.local_score - m1.local_score)
        .map(m => {
          const { gold_stars_count, silver_stars_count } = Object.keys(m.completion_day_level).reduce((starsStats, day) => {
            return {
              gold_stars_count: starsStats.gold_stars_count + ((m.completion_day_level[day][GOLD_STAR] !== undefined)?1:0),
              silver_stars_count: starsStats.silver_stars_count + ((m.completion_day_level[day][GOLD_STAR] === undefined && m.completion_day_level[day][SILVER_STAR] !== undefined)?1:0)
            };
          }, { gold_stars_count: 0, silver_stars_count: 0 });
          return {
            id: m.id,
            name: m.name,
            score: m.local_score,
            gold_stars_count,
            silver_stars_count,
            gold_stars: Leaderboard.range(gold_stars_count).map(_ => '⭐').join(''),
            silver_stars: Leaderboard.range(silver_stars_count).map(_ => '🌟').join(''),
            last_star_ts: m.last_star_ts
          };
        });
  }

  buildHallOfFameMessage() {
    let message = `Leaderboard :
${this.sortedMembers().map((m, idx) => `${Leaderboard.medalForIndex(idx)}${idx+1}) *[${m.score}]* ${m.gold_stars} ${m.silver_stars} ${m.name}`).join("\n")}
`;
    return message;
  }

  private static medalForIndex(index: number) {
    switch(index) {
      case 0: return '🥇';
      case 1: return '🥈';
      case 2: return '🥉';
      default: return '';
    }
  }

  private static range(max: number) {
    const arr = Array(max);
    for(var i=1; i<=max; i++){ arr[i-1] = i; }
    return arr;
  }
}

function doPost(e){
  AdventOfCodeBot.INSTANCE.log('Received payload: ' + JSON.stringify(e));
  var payload = JSON.parse(e.postData.contents);
  if(PROPS.SLACK_CHALLENGE_ACTIVATED === "true") {
    // ScoringBot.INSTANCE.log("Challenge activated and returned !");
    return ContentService.createTextOutput(payload.challenge);
  } else if(payload.action === 'refreshLeaderboard') {
    AdventOfCodeBot.INSTANCE.refreshLeaderboard();
    return;
  } else {
    AdventOfCodeBot.INSTANCE.log('POST event: ' + JSON.stringify(payload));
  }

  var event: SlackEvent = payload.event;
  return AdventOfCodeBot.INSTANCE.handle(event);
}

class AdventOfCodeBot {
  static readonly INSTANCE = new AdventOfCodeBot();

  private spreadsheetApp: Spreadsheet;

  private constructor() {
    this.spreadsheetApp = null;
  }

  handle(event: SlackEvent): void {
    try {
      if(AdventOfCodeBot.isBotResettedEvent(event)) {
        this.handleBotResetted(event);
      } else if(AdventOfCodeBot.isHelloCommand(event)) {
        this.botShouldSay(event.channel, "Hello world !", event.thread_ts);
      } else if(AdventOfCodeBot.isHelpCommand(event)) {
        this.showHelp(event);
      } else if(AdventOfCodeBot.isLeaderboardCommand(event)) {
        this.showLeaderboard(event);
      } else {
        this.log("No callback matched event !");
      }
    }catch(e){
      this.log(`Error during following payload : ${JSON.stringify(event)}: ${e.toString()}`);
    }
  }

  handleBotResetted(event: BotResettedEvent) {
    this.log("Bot reloaded: "+event.bot_id);
    return;
  }

  showHelp(event: ChannelMessageEvent) {
    const channel = event.channel;

    let message = `Hello ! I am a bot aimed at saying hello in this channel.
*Note*: _I look for interactions only once I am invited on the channel._

Following commands are available :
- \`!help\` : Shows help
- \`!leaderboard\` : Show leaderboard !
- \`!hello\` : Says hello world !
`;

    this.botShouldSay(channel, message, event.thread_ts);
  }

  showLeaderboard(event: ChannelMessageEvent) {
    const channel = event.channel;
    const leaderboard = this.fetchLeaderboard();
    this.botShouldSay(channel, leaderboard.buildHallOfFameMessage(), event.thread_ts);
  }

  fetchLeaderboard() {
    var payloadText = UrlFetchApp.fetch(`https://adventofcode.com/${CURRENT_YEAR}/leaderboard/private/view/${PROPS.ADVENT_OF_CODE_PRIVATE_LEARDERBOARD_CODE}.json`, {
      method: 'get',
      headers: {
        'cookie': `session=${PROPS.ADVENT_OF_CODE_SESSION_COOKIE}`
      }
    }).getContentText();
    this.log("leaderboard payload : "+payloadText);
    return new Leaderboard(JSON.parse(payloadText));
  }

  refreshLeaderboard() {
    const leaderboard = this.fetchLeaderboard();

    // TODO:
    //  - read previous leaderboard state from the spreadsheet
    //  - compare it to actual fetched leaderboard
    //  - produce "diffs" (member scores / stars)
    //  - Make the bot send a message with the diff
  }

  ensureSheetCreated(sheetName: string, headerCells: string[]|null, headerCellsType: "formulas"|"values"|null) {
    let sheet = this.getSheetByName(sheetName);
    if(!sheet) {
      sheet = this.getSpreadsheetApp().insertSheet(sheetName, 0);
      if(headerCells && headerCellsType) {
        this.setSheetHeaderRows(sheet, headerCells, headerCellsType);
      }
    }
    return sheet;
  }

  setSheetHeaderRows(sheet: Sheet, headerCells: string[], type: "formulas"|"values") {
    if(type === 'formulas') {
      sheet.getRange(1, 1, 1, headerCells.length).setFormulas([ headerCells ]);
    } else {
      sheet.getRange(1, 1, 1, headerCells.length).setValues([ headerCells ]);
    }
    sheet.getRange(1, 1, 1, sheet.getMaxColumns()).setFontWeight("bold");
  }

  retrieveMessageInfosFor(channel: string, messageId: string): MessageInfos|null {
    var payloadText = UrlFetchApp.fetch('https://slack.com/api/conversations.replies', {method: 'get', payload: { token: PROPS.SLACK_ACCESS_TOKEN, channel: channel, ts: messageId }}).getContentText();
    this.log("resulting conversations replies payload : "+payloadText);
    const payload = JSON.parse(payloadText);
    
    if(payload && payload.messages && payload.messages[0]) {
      return {
        threadId: payload.messages[0].thread_ts,
        threadAuthorId: payload.messages[0].parent_user_id || payload.messages[0].user as string,
        text: payload.messages[0].text
      };
    } else {
      return null;
    }
  }

  getSheetByName(name: string): Sheet {
    return this.getSpreadsheetApp().getSheetByName(name);
  }
  
  getSpreadsheetApp(): Spreadsheet {
    if(!this.spreadsheetApp) {
      this.spreadsheetApp = SpreadsheetApp.openById(PROPS.SPREADSHEET_ID);
    }
    return this.spreadsheetApp;
  }

  botShouldSay(channel: string, text: string, threadId?: string): void {
    var payload = {token: PROPS.SLACK_ACCESS_TOKEN, channel:channel, text:text, thread_ts: threadId };
    UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', {method: 'post', payload: payload});
  }

  log(text){
    if(PROPS.LOG_ENABLED === "true" && PROPS.SPREADSHEET_ID) {
      console.log(text);
      const logsSheet = this.ensureSheetCreated("Logs", null, null);
      logsSheet.appendRow([new Date(), text]);
    }
  }

  static isBotResettedEvent(event: SlackEvent): event is BotResettedEvent { return event.hasOwnProperty('bot_id'); }
  static isHelloCommand(event: SlackEvent): event is ChannelMessageEvent { return !!event.text.match(/!hello/); }
  static isLeaderboardCommand(event: SlackEvent): event is ChannelMessageEvent { return !!event.text.match(/!leaderboard/); }
  static isHelpCommand(event: SlackEvent): event is ChannelMessageEvent { return !!event.text.match(/!help/); }
}


import Spreadsheet = GoogleAppsScript.Spreadsheet.Spreadsheet;
import Sheet = GoogleAppsScript.Spreadsheet.Sheet;

const PROPS = {
  SLACK_ACCESS_TOKEN: PropertiesService.getScriptProperties().getProperty('SLACK_ACCESS_TOKEN'),
  LOG_ENABLED: PropertiesService.getScriptProperties().getProperty('LOG_ENABLED'),
  SPREADSHEET_ID: PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'),
  SLACK_CHALLENGE_ACTIVATED: PropertiesService.getScriptProperties().getProperty('SLACK_CHALLENGE_ACTIVATED')
};

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

function doPost(e){
  var payload = JSON.parse(e.postData.contents);
  if(PROPS.SLACK_CHALLENGE_ACTIVATED === "true") {
    // ScoringBot.INSTANCE.log("Challenge activated and returned !");
    return ContentService.createTextOutput(payload.challenge);
  } else {
    ScoringBot.INSTANCE.log('POST event: ' + JSON.stringify(payload));
  }

  var event: SlackEvent = payload.event;
  return ScoringBot.INSTANCE.handle(event);
}

class ScoringBot {
  static readonly INSTANCE = new ScoringBot();

  private spreadsheetApp: Spreadsheet;

  private constructor() {
    this.spreadsheetApp = null;
  }

  handle(event: SlackEvent): void {
    try {
      if(ScoringBot.isBotResettedEvent(event)) {
        this.handleBotResetted(event);
      } else if(ScoringBot.isHelloCommand(event)) {
        this.botShouldSay(event.channel, "Hello world !", event.thread_ts);
      } else if(ScoringBot.isHelpCommand(event)) {
        this.showHelp(event);
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
- \`!hello\` : Says hello world !
`;

    this.botShouldSay(channel, message, event.thread_ts);
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
  static isHelpCommand(event: SlackEvent): event is ChannelMessageEvent { return !!event.text.match(/!help/); }
}


/***
 * --- Akai MPK25 Controller Script with Clip Launching via the Pads ---
 * - Needed Settings on Keyboard:
 *	- CCs for Pads from 36 to at least 47 (if you just want to use Pad Bank A) or up to 83
 * 		( PAD 10 : 36, PAD 7 : 37, ..., PAD 11 : 40, ... )
 * - Launching of Clips does follow the selected Layout (Arrange View, Mix View)
 * 
 *TODO:
 * 	Get Channel volume and increment/decrement
 * 	Hi-Freqs and low freqs on knobs (for djing)
 * 	Selection frame (to replace popup notification top left)
 ***/

loadAPI(1);

// Initialisation
host.defineController("Akai", "MPK25 with Pads", "1.0", "0fddc5e0-296b-11e5-a2cb-0800200c9a66");
host.defineSysexIdentityReply("F0 7E ?? 06 02 47 72 00 19 00 ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? ?? F7");

//host.defineMidiPorts(2, 2);
//host.addDeviceNameBasedDiscoveryPair(["Akai MPK25 MIDI 1","Akai MPK25 MIDI 2"], ["Akai MPK25 MIDI 1","Akai MPK25 MIDI 2"]);
host.defineMidiPorts(1, 1);

if (host.platformIsWindows()) {
	host.addDeviceNameBasedDiscoveryPair(["MPK25"], ["MPK25"]);
}

else {
	host.addDeviceNameBasedDiscoveryPair(["Akai MPK25 MIDI 1"], ["Akai MPK25 MIDI 1"]);
}

var CC =
{
	// CC 12 - 35: Knobs
	K1A : 12,	// Shift pad selection vertical
	K2A : 13,	// Shift pad selection horizontal
	K3A : 14,
	K4A : 15,	// Select cursor track
	K5A : 16,
	K9A : 20,	// Volume Track 0 (+ Shift)
	K10A : 21,	// Volume Track 1 (+ Shift)
	K11A : 22,	// Volume Track 2 (+ Shift)
	K12A : 23,	// Volume Track 3 (+ Shift)
	K1B : 24,
	K2B : 25,
	K3B : 26,
	K4B : 27,
	K5B : 28,
	// CC 36 - 43: Switches
	S1A : 36,	// Sole
	S2A : 37,	// Mute
	S3A : 38,	// Loop
	S4A : 39,	// Metronome
	S1B : 40,	// Shift pad selection vertical + 4
	S2B : 41,	// Shift pad selection vertical + 4
	S3B : 42,	// Shift pad selection horizontal + 4
	S4B : 43,	// Shift pad selection horizontal + 4
	// CC 115 - 119: Transport
	REW : 115,
	FF : 116,
	STOP : 117,
	PLAY : 118,
	REC : 119,
	

};

//var isShift = false;
var isPlay = false;
var encoderId = 0;
var clip = 0;
var track = 0;
var selectedLayout = "NONE";
var shiftVertical = 0;
var shiftHorizontal = 0;
var knobShiftVertical = -1;
var knobShiftHorizontal = -1;
var cursorTrackSelect = -1;

var PadMIDITable = {
    ON:initCountingArray(0,128),
    OFF:initArray(-1,128)
};

function initCountingArray(startValue, length) {
    var arr = [];
    arr.length = length;
    for (var x = 0; x < arr.length; x++) {
        arr[x] = x;
    }
    return arr;
}

function init()
{
	host.getMidiInPort(0).setMidiCallback(onMidi);
	host.getMidiInPort(0).setSysexCallback(onSysex);
	host.getMidiOutPort(0).setShouldSendMidiBeatClock(true);
	MPK25Keys = host.getMidiInPort(0).createNoteInput("Keys", "?0????");
	MPK25Keys.setShouldConsumeEvents(false);
	
	MPK25Pads = host.getMidiInPort(0).createNoteInput("Pads", "?1????");
	MPK25Pads.setShouldConsumeEvents(false);
	MPK25Pads.setKeyTranslationTable(PadMIDITable.OFF);

	// Notifications:
	host.getNotificationSettings().setShouldShowSelectionNotifications(true);
	host.getNotificationSettings().setShouldShowChannelSelectionNotifications(true);
	host.getNotificationSettings().setShouldShowTrackSelectionNotifications(true);
	host.getNotificationSettings().setShouldShowDeviceSelectionNotifications(true);
	host.getNotificationSettings().setShouldShowDeviceLayerSelectionNotifications(true);
	host.getNotificationSettings().setShouldShowPresetNotifications(true);
	host.getNotificationSettings().setShouldShowMappingNotifications(true);
	host.getNotificationSettings().setShouldShowValueNotifications(true);

	transport = host.createTransport();
	application = host.createApplication();
	trackBank = host.createTrackBank(12, 0, 12);
	cursorTrack = host.createCursorTrack(2, 0);
	cursorDevice = cursorTrack.getPrimaryDevice();

	transport.addIsPlayingObserver(function(on)
	{
		isPlay = on;
	});
	
	application.addPanelLayoutObserver(panelLayout, 7);

	for ( var p = 0; p < 8; p++)
	{
		cursorDevice.getMacro(p).getAmount().setIndication(true);
		cursorDevice.getParameter(p).setIndication(true);
		cursorDevice.getParameter(p).setLabel("P" + (p + 1));
	}
}


function onMidi(status, data1, data2)
{
	var pressed = data2 > 64; // ignore button release
	
	// DEBUG
	//host.showPopupNotification("status: "+status+", data1: "+data1+", data2: "+data2);
	
	// Pads (CH 2A: CC36 - 83)
	if (status & 0x1)
	{
		pressed = data2 > 0;
    
		if (pressed == true)
		{
			if (selectedLayout == "MIX") {
			  
				clip = ((data1 - 36) % 4) + shiftVertical;
				track = ((data1 - 36) / 4) + shiftHorizontal;
			}
			  
			else {
			  
				track = ((data1 - 36) % 4) + shiftVertical;
				clip = ((data1 - 36) / 4) + shiftHorizontal;
			}
			
			trackBank.getTrack(track).getClipLauncherSlots().launch(clip);
		}
	}

	// Knobs, switches and transport
	else if (isChannelController(status)) {

		/*if (data1 >= CC.K5A && data1 < CC.K5A + 8)
		{
			cursorDevice.getMacro(data1 - CC.K5A).getAmount().set(data2, 128);
		}
		if (data1 >= CC.K5B && data1 < CC.K5B + 8)
		{
			cursorDevice.getParameter(data1 - CC.K5B).set(data2, 128);
		}*/
		switch (data1)
		{
		case CC.K1A:
			if (knobShiftVertical == -1)
				knobShiftVertical = data2;
			else {
				if (data2 > knobShiftVertical)
					shiftVertical = shiftVertical + 1;
				else
					shiftVertical = shiftVertical - 1;
				
				knobShiftVertical = -1;
				
				host.showPopupNotification("Top left at: "+ shiftHorizontal +" / "+ shiftVertical);
			}
			break;
		case CC.K2A:
			if (knobShiftHorizontal == -1)
				knobShiftHorizontal = data2;
			else {
				if (data2 > knobShiftHorizontal)
					shiftHorizontal = shiftHorizontal + 1;
				else
					shiftHorizontal = shiftHorizontal - 1;
				
				knobShiftHorizontal = -1;
				
				host.showPopupNotification("Top left at: "+ shiftHorizontal +" / "+ shiftVertical);
			}
			break;
		/*case CC.K3A:
			cursorTrack.getSend(0).set(data2, 128);
			break;*/
		case CC.K4A:
			if (cursorTrackSelect == -1)
				cursorTrackSelect = data2;
			else {
				if (data2 > cursorTrackSelect)
					cursorTrack.selectNext();
				else
					cursorTrack.selectPrevious();
				
				cursorTrackSelect = -1;
			}
			break;
		case CC.K9A:
			if (selectedLayout == "MIX")
				trackBank.getTrack(Math.floor(shiftHorizontal/3)).getVolume().set(data2, 128);
			else
				trackBank.getTrack(shiftVertical).getVolume().set(data2, 128);
			break;
		case CC.K10A:
			if (selectedLayout == "MIX")
				trackBank.getTrack(Math.floor(shiftHorizontal/3)+1).getVolume().set(data2, 128);
			else
				trackBank.getTrack(shiftVertical+1).getVolume().set(data2, 128);
			break;
		case CC.K11A:
			if (selectedLayout == "MIX")
				trackBank.getTrack(Math.floor(shiftHorizontal/3)+2).getVolume().set(data2, 128);
			else
				trackBank.getTrack(shiftVertical+2).getVolume().set(data2, 128);
			break;
		case CC.K12A:
			if (selectedLayout == "MIX")
				trackBank.getTrack(Math.floor(shiftHorizontal/3)+3).getVolume().set(data2, 128);
			else
				trackBank.getTrack(shiftVertical+3).getVolume().set(data2, 128);
			break;
		/*case CC.K1B:
			cursorTrack.getVolume().set(data2, 128);
			break;
		case CC.K2B:
			cursorTrack.getPan().set(data2, 128);
			break;
		case CC.K3B:
			cursorTrack.getSend(0).set(data2, 128);
			break;
		case CC.K4B:
			cursorTrack.getSend(1).set(data2, 128);
			break;
		case CC.S1B:
			isShift = data2 > 64;
			break;*/
		}

		if (pressed)
		{
			switch (data1)
			{
			case CC.PLAY:
				/*isShift ? transport.returnToArrangement() : */transport.play();
				break;
			case CC.STOP:
				/*isShift ? transport.resetAutomationOverrides() : */transport.stop();
				break;
			case CC.REC:
				/*isShift ? cursorTrack.getArm().toggle() : */transport.record();
				break;
			case CC.REW:
				/*isShift ? cursorTrack.selectPrevious() : */transport.rewind();
				break;
			case CC.FF:
				/*isShift ? cursorTrack.selectNext() : */transport.fastForward();
				break;
			case CC.S1A:
				cursorTrack.getSolo().toggle();
				break;
			case CC.S2A:
				cursorTrack.getMute().toggle();
				break;
			case CC.S3A:
				transport.toggleLoop();
				break;
			case CC.S4A:
				transport.toggleClick();
				break;
			case CC.S1B:
				shiftVertical = shiftVertical - 4;
				host.showPopupNotification("Top left at: "+ shiftHorizontal +" / "+ shiftVertical);
				break;
			case CC.S2B:
				shiftVertical = shiftVertical + 4;
				host.showPopupNotification("Top left at: "+ shiftHorizontal +" / "+ shiftVertical);
				break;
			case CC.S3B:
				shiftHorizontal = shiftHorizontal  - 12;
				host.showPopupNotification("Top left at: "+ shiftHorizontal +" / "+ shiftVertical);
				break;
			case CC.S4B:
				shiftHorizontal = shiftHorizontal  + 12;
				host.showPopupNotification("Top left at: "+ shiftHorizontal +" / "+ shiftVertical);
				break;
			}
		}
	}
}

function onSysex(data)
{
	// printSysex(data);
}

function panelLayout(layout)
{
	selectedLayout = layout;
}

function exit()
{

}
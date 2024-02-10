function IonDiscoverDJ () {}
 
IonDiscoverDJ.leds = {
   "scratch":0x48,
   "[Channel1] sync":0x40,
   "[Channel1] rev":0x33,
   "[Channel1] cue":0x3B,
   "[Channel1] play":0x4A,
   "[Channel2] sync":0x47,
   "[Channel2] rev":0x3C,
   "[Channel2] cue":0x42,
   "[Channel2] play":0x4C
};
 
IonDiscoverDJ.debug = true;
IonDiscoverDJ.ledOn = 0x7F;
IonDiscoverDJ.ledOff = 0x00;
IonDiscoverDJ.scratchMode = false;
IonDiscoverDJ.pitchDial1 = false;
IonDiscoverDJ.pitchDial2 = false;
IonDiscoverDJ.shiftMode = false;
IonDiscoverDJ.filterKnobHeld = false;
 
IonDiscoverDJ.init = function (id) {    // called when the MIDI device is opened & set up
   print ("Ion Discover DJ id: \""+id+"\" initialized.");
 
   var timeToWait = 20;
   for (var LED in IonDiscoverDJ.leds ) {
       IonDiscoverDJ.sendMidi(0x80, IonDiscoverDJ.leds[LED], IonDiscoverDJ.ledOff, timeToWait);
       timeToWait += 5;
   }
 
   for (var LED in IonDiscoverDJ.leds ) {
       IonDiscoverDJ.sendMidi(0x90, IonDiscoverDJ.leds[LED], IonDiscoverDJ.ledOn, timeToWait);
       timeToWait += 5;
   }
 
   timeToWait += 1000;
   for (var LED in IonDiscoverDJ.leds ) {
       IonDiscoverDJ.sendMidi(0x80, IonDiscoverDJ.leds[LED], IonDiscoverDJ.ledOff, timeToWait);
       timeToWait += 5;
   }
 
   engine.connectControl("[Channel1]", "play_indicator", "IonDiscoverDJ.PlayLED");
   engine.connectControl("[Channel2]", "play_indicator", "IonDiscoverDJ.PlayLED");
   engine.connectControl("[Channel1]", "cue_indicator", "IonDiscoverDJ.CueLED");
   engine.connectControl("[Channel2]", "cue_indicator", "IonDiscoverDJ.CueLED");
   engine.connectControl("[Channel1]", "beat_active", "IonDiscoverDJ.SyncLED");
   engine.connectControl("[Channel2]", "beat_active", "IonDiscoverDJ.SyncLED");
   engine.connectControl("[Channel1]", "pfl", "IonDiscoverDJ.RevLED");
   engine.connectControl("[Channel2]", "pfl", "IonDiscoverDJ.RevLED");
};
 
IonDiscoverDJ.sendMidi = function(status, control, value, timeToWait) {
   if(timeToWait == 0) {
      midi.sendShortMsg(status, control, value);
   } else {
      engine.beginTimer(timeToWait, "midi.sendShortMsg(" + status + ", " + control + ", " + value + ")", true);
   }
};
 
 
 
//Decks
IonDiscoverDJ.Deck = function (deckNumber, group) {
   this.deckNumber = deckNumber;
   this.group = group;
   this.scratching = false;
   this.Buttons = [];
};
 
IonDiscoverDJ.Deck.prototype.jogMove = function(jogValue) {
   if(this.scratching) {
      engine.scratchTick(this.deckNumber, jogValue/3);
   } else {
      jogValue = jogValue /7.5;
      //print("DEBUG jog value",jogValue);
      engine.setValue(this.group,"jog", jogValue);
   }
};
 
IonDiscoverDJ.Decks = {"Left":new IonDiscoverDJ.Deck(1,"[Channel1]"), "Right":new IonDiscoverDJ.Deck(2,"[Channel2]")};
IonDiscoverDJ.GroupToDeck = {"[Channel1]":"Left", "[Channel2]":"Right"};
 
IonDiscoverDJ.GetDeck = function(group) {
   try {
      return IonDiscoverDJ.Decks[IonDiscoverDJ.GroupToDeck[group]];
   } catch(ex) {
      return null;
   }
};
 
 
IonDiscoverDJ.getControl = function (io, channel, name) {
    // Accept channel in form 'N' or '[ChannelN]'
    channel = channel.replace(/\[Channel(\d)\]/, "$1");
 
    for (control in IonDiscoverDJ.controls.inputs) {
    if (IonDiscoverDJ.controls.inputs[control].channel == channel &&
        IonDiscoverDJ.controls.inputs[control].name == name
        ) return IonDiscoverDJ.controls.inputs[control];
    }
 
    print ("IonDiscoverDJ.getControl: Control not found: io=" + io + ": channel=" + channel + ": name=" + name);
}
 
IonDiscoverDJ.shutdown = function() {
}
 
IonDiscoverDJ.toggle_scratch_mode_on = function (control, value, status) {
    if(IonDiscoverDJ.scratchMode) {
       IonDiscoverDJ.scratchMode = false;
       midi.sendShortMsg(0x80, IonDiscoverDJ.leds["scratch"] , IonDiscoverDJ.ledOff);
    } else {
       IonDiscoverDJ.scratchMode = true;
       midi.sendShortMsg(0x90, IonDiscoverDJ.leds["scratch"] , IonDiscoverDJ.ledOn);
    }
}

IonDiscoverDJ.tempoUp = function (control, value, status) {
   if(IonDiscoverDJ.shiftMode) {
      engine.setValue("[Channel1]","rate", engine.getValue("[Channel1]","rate") + 0.01);
   } else {
      engine.setValue("[Channel1]","rate", engine.getValue("[Channel1]","rate") + 0.05);
   }
}  
 
 
IonDiscoverDJ.jog_touch = function (channel, control, value, status, group) {
   var deck = IonDiscoverDJ.GetDeck(group);
   if(value) {
      if(IonDiscoverDJ.scratchMode) {
         engine.scratchEnable(deck.deckNumber, 128, 45, 1.0/8, (1.0/8)/32);
         deck.scratching = true;
      }
   } else {
      deck.scratching = false;
      engine.scratchDisable(deck.deckNumber);
   }
};
 
IonDiscoverDJ.jog_wheel = function (channel, control, value, status, group) {
   // 7F > 40: CCW Slow > Fast - 127 > 64
   // 01 > 3F: CW Slow > Fast - 0 > 63
   var jogValue = value >=0x40 ? value - 0x80 : value; // -64 to +63, - = CCW, + = CW
   IonDiscoverDJ.GetDeck(group).jogMove(jogValue);
};

// Reverse selects headphone cue
IonDiscoverDJ.reversek = function (channel, control, value, status, group) {
   if (group == "[Channel1]") {
      IonDiscoverDJ.pflCh1()
   }
   else { //if (group == "[Channel2]")
      IonDiscoverDJ.pflCh2()
   }
 
}
 
IonDiscoverDJ.pflCh1 = function () {
    if(engine.getValue("[Channel1]", "pfl")){
       engine.setValue("[Channel1]","pfl", false);
    }
    else {
       engine.setValue("[Channel1]","pfl", true);
    }
}
 
 
 
IonDiscoverDJ.pflCh2 = function () {
    if(engine.getValue("[Channel2]", "pfl")){
       engine.setValue("[Channel2]","pfl", false);
    }
    else {
       engine.setValue("[Channel2]","pfl", true);
    }
}
 
 
IonDiscoverDJ.EnableFilterTrack1 = function (group, control, value, status) {
   if(engine.getValue("[EffectRack1_EffectUnit1_Effect1]", "enabled")){
      engine.setValue("[EffectRack1_EffectUnit1_Effect1]","enabled", false);
   }
   else {
      engine.setValue("[EffectRack1_EffectUnit1_Effect1]","enabled", true);
   }
   if(engine.getValue("[EffectRack1_EffectUnit1_Effect2]", "enabled")){
      engine.setValue("[EffectRack1_EffectUnit1_Effect2]","enabled", false);
   }
   else {
      engine.setValue("[EffectRack1_EffectUnit1_Effect2]","enabled", true);
   }
   if(engine.getValue("[EffectRack1_EffectUnit1_Effect3]", "enabled")){
      engine.setValue("[EffectRack1_EffectUnit1_Effect3]","enabled", false);
   }
   else {
      engine.setValue("[EffectRack1_EffectUnit1_Effect3]","enabled", true);
   }
}
 
IonDiscoverDJ.EnableFilterTrack2 = function (group, control, value, status) {
   if(engine.getParameter("[EffectRack1_EffectUnit2_Effect1]", "enabled")){
       engine.setParameter("[EffectRack1_EffectUnit2_Effect1]","enabled", false);
   }
   else {
       engine.setParameter("[EffectRack1_EffectUnit2_Effect1]","enabled", true);
   }
   if(engine.getParameter("[EffectRack1_EffectUnit2_Effect2]", "enabled")){
      engine.setParameter("[EffectRack1_EffectUnit2_Effect2]","enabled", false);
   }
   else {
      engine.setParameter("[EffectRack1_EffectUnit2_Effect2]","enabled", true);
   }
   if(engine.getParameter("[EffectRack1_EffectUnit2_Effect3]", "enabled")){
      engine.setParameter("[EffectRack1_EffectUnit2_Effect3]","enabled", false);
   }
   else {
      engine.setParameter("[EffectRack1_EffectUnit2_Effect3]","enabled", true);
   }
}
 
IonDiscoverDJ.filterKnobHeld = function (group, control, value) {
   IonDiscoverDJ.filterKnobHeld = (value == 0x7F); //If button down on, else off
}
 
IonDiscoverDJ.FilterWheel = function (channel, control, value, status, group) {
   var wheelRightTurn = (value == 1);
   var wheelLeftTurn = !wheelRightTurn;
   //
   var increment = 0.025
   var effectNum = "1"
   if (IonDiscoverDJ.filterKnobHeld) {
      effectNum = "2"
      increment = 0.1
   }
   var oldValue1 = engine.getParameter("[EffectRack1_EffectUnit1_Effect" + effectNum + "]","meta");
   var oldValue2 = engine.getParameter("[EffectRack1_EffectUnit2_Effect" + effectNum + "]","meta");
   if (wheelLeftTurn) {
       if (oldValue1 > -1){
           var newValue1 = oldValue1 - increment > 0 ? oldValue1 - increment : 0.0;
           engine.setParameter("[EffectRack1_EffectUnit1_Effect" + effectNum + "]","meta", newValue1);
       }
       if (oldValue2 > -1){
           var newValue2 = oldValue2 - increment > 0 ? oldValue2 - increment : 0.0;
           engine.setParameter("[EffectRack1_EffectUnit2_Effect" + effectNum + "]","meta", newValue2);
       }
   }
   else { // wheel right turn
       if (oldValue1 < 1){
           var newValue1 = oldValue1 + increment > 1 ? 1 : oldValue1 + increment;
           engine.setParameter("[EffectRack1_EffectUnit1_Effect" + effectNum + "]","meta", newValue1);
       }
       if (oldValue2 < 1){
           var newValue2 = oldValue2 + increment > 1 ? 1 : oldValue2 + increment;
           engine.setParameter("[EffectRack1_EffectUnit2_Effect" + effectNum + "]","meta", newValue2);
       }
   }
};
 
IonDiscoverDJ.PlayLED = function (value, group, control) {
    var deck = IonDiscoverDJ.GetDeck(group);
    if(value) {
        midi.sendShortMsg(0x90, IonDiscoverDJ.leds["[Channel" + deck.deckNumber +"] play"], IonDiscoverDJ.ledOn);
    } else {
        midi.sendShortMsg(0x90, IonDiscoverDJ.leds["[Channel" + deck.deckNumber +"] play"], IonDiscoverDJ.ledOff);
    }
}
 
IonDiscoverDJ.CueLED = function (value, group, control) {
    var deck = IonDiscoverDJ.GetDeck(group);
    if(value) {
        midi.sendShortMsg(0x90, IonDiscoverDJ.leds["[Channel" + deck.deckNumber +"] cue"], IonDiscoverDJ.ledOn);
    } else {
        midi.sendShortMsg(0x90, IonDiscoverDJ.leds["[Channel" + deck.deckNumber +"] cue"], IonDiscoverDJ.ledOff);
    }
}
 
IonDiscoverDJ.SyncLED = function (value, group, control) {
    var deck = IonDiscoverDJ.GetDeck(group);
    if(value) {
        midi.sendShortMsg(0x90, IonDiscoverDJ.leds["[Channel" + deck.deckNumber +"] sync"], IonDiscoverDJ.ledOn);
    } else {
        midi.sendShortMsg(0x90, IonDiscoverDJ.leds["[Channel" + deck.deckNumber +"] sync"], IonDiscoverDJ.ledOff);
    }
}
 
IonDiscoverDJ.RevLED = function (value, group, control) {
    var deck = IonDiscoverDJ.GetDeck(group);
    if(value) {
        midi.sendShortMsg(0x90, IonDiscoverDJ.leds["[Channel" + deck.deckNumber +"] rev"], IonDiscoverDJ.ledOn);
    } else {
        midi.sendShortMsg(0x90, IonDiscoverDJ.leds["[Channel" + deck.deckNumber +"] rev"], IonDiscoverDJ.ledOff);
    }
}
 
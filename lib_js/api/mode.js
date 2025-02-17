/*

Glǽmscribe (also written Glaemscribe) is a software dedicated to
the transcription of texts between writing systems, and more 
specifically dedicated to the transcription of J.R.R. Tolkien's 
invented languages to some of his devised writing systems.

Copyright (C) 2015 Benjamin Babut (Talagan).

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/

Glaemscribe.ModeDebugContext = function()
{
  this.preprocessor_output  = "";
  this.processor_pathes     = [];
  this.processor_output     = [];
  this.postprocessor_output = "";
  this.tts_output = "";
  
  return this;
}


Glaemscribe.Mode = function(mode_name) {
  this.name                 = mode_name;
  this.supported_charsets   = {};
  this.options              = {};
  this.errors               = [];
  this.warnings             = [];
  this.latest_option_values = {};
  this.has_tts              = false;
  this.current_tts_voice    = null;
  
  this.raw_mode_name        = null;

  this.pre_processor    = new Glaemscribe.TranscriptionPreProcessor(this);
  this.processor        = new Glaemscribe.TranscriptionProcessor(this);
  this.post_processor   = new Glaemscribe.TranscriptionPostProcessor(this);
  
  return this;
}

Glaemscribe.Mode.prototype.finalize = function(options) {
  
  var mode = this;
  
  if(options == null)
    options = {};
  
  // Hash: option_name => value_name
  var trans_options = {};
  
  // Build default options
  glaemEach(mode.options, function(oname, o) {
    trans_options[oname] = o.default_value_name;
  });
  
  // Push user options
  glaemEach(options, function(oname, valname) {
    // Check if option exists
    var opt = mode.options[oname];
    if(!opt)
      return true; // continue
    var val = opt.value_for_value_name(valname)
    if(val == null)
      return true; // value name is not valid
    
    trans_options[oname] = valname;
  });
    
  var trans_options_converted = {};
 
  // Do a conversion to values space
  glaemEach(trans_options, function(oname,valname) {
    trans_options_converted[oname] = mode.options[oname].value_for_value_name(valname);
  });

  // Add the option defined constants to the whole list for evaluation purposes
  glaemEach(mode.options, function(oname, o) {
    // For enums, add the values as constants for the evaluator
    if(o.type == Glaemscribe.Option.Type.ENUM )
    {
      glaemEach(o.values, function(name,val) {
        trans_options_converted[name] = val
      });
    }
  });   
  
  this.latest_option_values = trans_options_converted;
    
  this.pre_processor.finalize(this.latest_option_values);
  this.post_processor.finalize(this.latest_option_values);
  this.processor.finalize(this.latest_option_values);
  
  if(mode.get_raw_mode())
    mode.get_raw_mode().finalize(options);
  
  if(this.has_tts) {
    var espeak_option       = mode.options['espeak_voice'].value_name_for_value(mode.latest_option_values['espeak_voice'])
    this.current_tts_voice  = Glaemscribe.TTS.option_name_to_voice(espeak_option)
  }
  
  return this;
}

Glaemscribe.Mode.prototype.get_raw_mode = function() {
  var mode = this;
  
  if(mode.raw_mode != null)
    return mode.raw_mode;
  
  var loaded_raw_mode = (mode.raw_mode_name && Glaemscribe.resource_manager.loaded_modes[mode.raw_mode_name]);
  if(loaded_raw_mode == null)
    return null;
  
  mode.raw_mode = Object.glaem_clone(loaded_raw_mode);
  return mode.raw_mode;
}

// Transcribe, but with raw tengwar evacuated
Glaemscribe.Mode.prototype.strict_transcribe = function(content, charset, debug_context) {
  
  var mode = this;

  if(charset == null)
    charset = this.default_charset;
  
  if(charset == null)
    return [false, "*** No charset usable for transcription. Failed!"];

  // TTS pre-transcription
  if(mode.has_tts) {
    try {
      // Pre-ipa conversion with TTS engine
      var esp = new Glaemscribe.TTS(); 
      var res = esp.synthesize_ipa(content,{voice: mode.current_tts_voice, has_raw_mode: (mode.get_raw_mode() != null) });
      content = res['ipa'];

      debug_context.tts_output += content;
    } catch(e) {
      return [false, "TTS pre-transcription failed : " + e];
    }
  }

  var ret   = ""
  var lines = content.split(/(\n)/);
  
  for(var i=0;i<lines.length;i++)
  {
    var l = lines[i];
    var restore_lf = false;
    
    if(l[l.length-1] == "\n")
    {
      restore_lf = true;
      l = l.slice(0,-1);
    }
    
    l = this.pre_processor.apply(l);
    debug_context.preprocessor_output += l + "\n";
    
    l = this.processor.apply(l, debug_context);
    debug_context.processor_output = debug_context.processor_output.concat(l);
    
    l = this.post_processor.apply(l, charset);
    debug_context.postprocessor_output += l + "\n";

    if(restore_lf)
      l += "\n";
    
    ret += l;
  }
  
  return [true, ret, debug_context];  
}

Glaemscribe.Mode.prototype.transcribe = function(content, charset) {

  var mode          = this;
  var debug_context = new Glaemscribe.ModeDebugContext();

  var raw_mode      = mode.get_raw_mode();

  var ret = "";
  var res = true;
   
  if(raw_mode != null)
  {
    var chunks = content.split(/({{[\s\S]*?}})/);
       
    glaemEach(chunks, function(_,c) {
      var rmatch = null;
      
      var to_transcribe = c;
      var tr_mode       = mode;
      
      if(rmatch = c.match(/{{([\s\S]*?)}}/))
      {
        to_transcribe = rmatch[1];
        tr_mode       = raw_mode;
        // Don't forget to keep raw things inside tts output
        // debug_context.tts_output += "{{" + to_transcribe + "}}";
      }
      
      var rr = tr_mode.strict_transcribe(to_transcribe,charset,debug_context);
      var succ = rr[0]; var r = rr[1]; 
      
      if(!succ)
        return [false, r , debug_context];
        
      ret += r;   
    });
  }
  else
  {
    var rr = mode.strict_transcribe(content,charset,debug_context);
    var succ = rr[0]; var r = rr[1]; 

    if(!succ)
      return [false, r , debug_context];
      
    ret += r;   
  }
    
  return [res, ret, debug_context];  
}


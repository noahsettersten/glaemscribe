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

/*
  A post processor operator to replace the out_space on the fly.
  This has the same effect as the \outspace parameter
  But can be included in the postprocessor and benefit from the if/then logic
*/

Glaemscribe.OutspacePostProcessorOperator = function(mode, glaeml_element)
{
  Glaemscribe.PostProcessorOperator.call(this, mode, glaeml_element); //super
  
  this.out_space  = stringListToCleanArray(glaeml_element.args[0], /\s/);
  
  return this;
} 
Glaemscribe.OutspacePostProcessorOperator.inheritsFrom( Glaemscribe.PostProcessorOperator );  

Glaemscribe.OutspacePostProcessorOperator.prototype.apply = function(tokens, charset)
{
  this.mode.post_processor.out_space = this.out_space;
  return tokens;
}  

Glaemscribe.resource_manager.register_post_processor_class("outspace", Glaemscribe.OutspacePostProcessorOperator);    

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FloopView } from './floop/floop.view';
import { SynthService } from './services/synth.service';



@NgModule( {
	imports: [
		CommonModule,
	],
	declarations: [
		FloopView,
	],
	providers: [
		SynthService,
	],
} )
export class FloopModule{}

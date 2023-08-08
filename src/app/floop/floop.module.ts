import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FloopView } from './floop/floop.view';
import { SynthService } from './services/synth.service';



@NgModule( {
	imports: [
		CommonModule,
		IonicModule,
	],
	declarations: [
		FloopView,
	],
	providers: [
		SynthService,
	],
} )
export class FloopModule{}

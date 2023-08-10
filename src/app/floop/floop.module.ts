import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { BootScreenComponent } from './floop/components/boot-screen.component';
import { InstrumentScreenComponent } from './floop/components/instrument-screen.component';
import { SettingsScreenComponent } from './floop/components/settings-screen.component';
import { VizScreenComponent } from './floop/components/viz-screen.component';
import { FloopView } from './floop/floop.view';
import { SynthService } from './services/synth.service';



@NgModule( {
	imports: [
		CommonModule,
		IonicModule,
	],
	declarations: [
		FloopView,
		BootScreenComponent,
		SettingsScreenComponent,
		VizScreenComponent,
		InstrumentScreenComponent,
	],
	providers: [
		SynthService,
	],
} )
export class FloopModule{}

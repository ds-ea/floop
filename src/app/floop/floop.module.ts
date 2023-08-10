import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BootScreenComponent } from './floop/components/boot-screen.component';
import { InstrumentScreenComponent } from './floop/components/instrument-screen.component';
import { SettingsScreenComponent } from './floop/components/settings-screen.component';
import { VizScreenComponent } from './floop/components/viz-screen.component';
import { FloopView } from './floop/floop.view';
import { FloopDeviceService } from './services/floop-device.service';
import { SynthService } from './services/synth.service';



@NgModule( {
	imports: [
		CommonModule,
		IonicModule,
		FormsModule,
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
		FloopDeviceService
	],
} )
export class FloopModule{}

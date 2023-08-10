import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { InputStepperComponent } from './floop/components/stepper/input-stepper.component';
import { BootScreenComponent } from './floop/screens/boot-screen.component';
import { InstrumentScreenComponent } from './floop/screens/instrument-screen.component';
import { SettingsScreenComponent } from './floop/screens/settings-screen.component';
import { VizScreenComponent } from './floop/screens/viz-screen.component';
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
		InputStepperComponent,

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

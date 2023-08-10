import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { settings } from 'ionicons/icons';
import { FloopDeviceService } from '../../services/floop-device.service';
import { SynthService } from '../../services/synth.service';
import { FloopSettings } from '../../types/floop.types';


@Component( {
	selector: 'settings-screen',
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles:[`
		:host {
			display: flex;
			flex-direction: column;
			overflow: auto;

			justify-content: flex-start;
		}
		ion-list{
			--ion-border-color: #000000;
			padding: 0;
		}
		ion-item{
			--border-width: 0 0 4px 0 !important;
			//--padding-top: 20px;
			//--padding-bottom: 20px;

			ion-item{
				--border-width: 0!important;

			}
		}

	`],
	template: `

		<ion-spinner *ngIf="busy" name="circular"></ion-spinner>

		<ion-list *ngIf="!busy" lines="full">
			<ion-item>
				<ion-checkbox [(ngModel)]="settings.quickBoot"
							  (ngModelChange)="settingsChanged()"
							  labelPlacement="start"
				>Quick Boot (skips boot animation)
				</ion-checkbox>
			</ion-item>

			<ion-item>
				<ion-range aria-label="Volume"
						   labelPlacement="start" label="Volume"
						   [(ngModel)]="settings.deviceVolume"
						   (ngModelChange)="settingsChanged()"
						   min="0" max="100"
				>
					<ion-icon slot="start" name="volume-low"></ion-icon>
					<ion-icon slot="end" name="volume-high"></ion-icon>
				</ion-range>
			</ion-item>

			<ion-item >
				<input-stepper [(ngModel)]="bpm"
							   (ngModelChange)="setBPM($event)"
							   [min]="1"
							   label="BPM"
				></input-stepper>
			</ion-item>
		</ion-list>

	`,
} )

export class SettingsScreenComponent implements OnInit{
	public busy = false;

	public settings:FloopSettings = {};

	public bpm:number;

	constructor(
		public floopDevice:FloopDeviceService,
		public synth:SynthService,
		public cdr:ChangeDetectorRef
	){
		this.bpm = this.synth.bpm;

		this.floopDevice.settingsChanged
			.pipe(takeUntilDestroyed())
			.subscribe( settings => {
				this.settings = settings;
				this.cdr.markForCheck();
			} );
	}

	async ngOnInit(){
		this.busy = true;
		this.cdr.markForCheck();

		await this.floopDevice.restoreSettings();
		this.settings = this.floopDevice.settings;
		this.busy = false;
		this.cdr.markForCheck();
	}

	public settingsChanged(){
		this.floopDevice.settings = this.settings;
	}

	public setBPM(bpm:number){
		this.synth.bpm = bpm;
	}

}

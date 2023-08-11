import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, ComponentRef, DestroyRef, Directive, EventEmitter, Injector, Input, OnChanges, OnInit, SimpleChange, SimpleChanges, TemplateRef, Type, ViewChild, ViewContainerRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Preferences } from '@capacitor/preferences';
import { CompOutDirective } from '../../../directives/comp-out.directive';
import { FloopDeviceService } from '../../../services/floop-device.service';
import { SynthService } from '../../../services/synth.service';
import { SynthInstrument } from '../../../types/synth.types';
import { InstrumentPage } from './instrument.page';
import { OscillatorPage } from './oscillator.page';



export interface FloopDisplayInstrumentPageComponent extends OnChanges{
	instrument:SynthInstrument | undefined;
	instrumentChange?:EventEmitter<SynthInstrument | undefined>;
}

type FloopDisplayPage = {
	id:string;
	label:string;
	component?:Type<FloopDisplayInstrumentPageComponent>
};

// TODO: try new componentoutlet with inputs after updating to ng16.2



@Component( {
	selector: 'instrument-screen',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<section class="main">
			<ng-template comp-out #pageOut></ng-template>
		</section>
		<section class="screen-nav">
			<ul>
				<li *ngFor="let page of pages">
					<a (click)="selectPage(page)" [class.active]="currentPage?.id === page.id ">
						{{page.label}}
					</a>
				</li>
			</ul>
		</section>
	`,
} )

export class InstrumentScreenComponent implements OnInit, OnChanges, AfterViewInit{
	@ViewChild( CompOutDirective, {static: true } ) pageTarget!:CompOutDirective;

	@Input( 'instrument' ) instrumentNum:number | undefined;
	public instrument:SynthInstrument | undefined;

	public currentPage:FloopDisplayPage | undefined;
	public pages:FloopDisplayPage[] = [
		{ id: 'instrument', label: 'inst', component: InstrumentPage },
		{ id: 'oscillator', label: 'osc', component: OscillatorPage },
		{ id: 'envelope', label: 'env' },
		{ id: 'fx', label: 'fx' },
		//		{id: 'mix', label: 'mix'},
	];

	private _pageInstance:ComponentRef<FloopDisplayInstrumentPageComponent>|undefined;
	private _restorePage?:string;

	constructor(
		private cdr:ChangeDetectorRef,
		private synth:SynthService,
		private injector:Injector,
		private destroyRef:DestroyRef,
		private floopDevice:FloopDeviceService
	){
		this._restorePage = this.floopDevice.memory.lastInstrumentPage || 'instrument';
	}

	ngOnInit(){

	}

	public ngOnChanges( changes:SimpleChanges ):void{
		if( 'instrumentNum' in changes )
			this._loadInstrument( this.instrumentNum );
	}

	public ngAfterViewInit():void{
	}


	private _loadInstrument( instrumentNum:number | undefined ){
		this.instrument = this.synth.instruments[instrumentNum!];

		if( !this.currentPage )
			this.selectPage( this.pages.find( p => p.id === this._restorePage) || this.pages[0] );

		if( this._pageInstance ){
			this._pageInstance.instance.instrument = this.instrument;

			const changes:SimpleChanges = {
				instrument: new SimpleChange(this._pageInstance.instance.instrument, this.instrument, false)
			};
			this._pageInstance.instance.ngOnChanges(changes);

		}

		this.cdr.markForCheck();
	}

	public selectPage( page:FloopDisplayPage ){
		this.currentPage = page;

		const vcr = this.pageTarget.viewContainerRef;
		if( !vcr )
			throw new Error( 'no component outlet' );

		vcr.clear();

		if( !page.component )
			return;

		this._pageInstance = vcr.createComponent<FloopDisplayInstrumentPageComponent>( page.component, {injector: this.injector } );
		this._pageInstance.instance['instrument'] = this.instrument;
		if( this._pageInstance.instance.instrumentChange )
			this._pageInstance.instance.instrumentChange
				.pipe( takeUntilDestroyed(this.destroyRef) )
				.subscribe( instrument => {
					this.instrument = instrument;
					this._propagateInstrumentChanges();
					this.cdr.markForCheck();
				} );


		this._restorePage = page.id;
		this.floopDevice.updateMemory({lastInstrumentPage: this._restorePage});
	}

	private _propagateInstrumentChanges(){
		if( this.instrumentNum == null || !this.instrument )
			return;

		this.synth.updateInstrument( this.instrumentNum, this.instrument );
	}
}

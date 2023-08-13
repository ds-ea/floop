import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter, HostBinding, Input, OnInit, Output, Renderer2, ViewChild } from '@angular/core';
import { BtnData } from '../../types/floop.types';


@Component( {
	selector: 'screen-button',
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<button *ngIf="btn">
			<span *ngIf="btn.overlay"
				  class="overlay"
			>{{btn.overlay}}</span>

			<ion-icon *ngIf="btn.icon"
					  class="icon"
					  [name]="btn.icon"
			></ion-icon>
			<ng-container *ngIf="!btn.icon">
				{{btn.label ?? ''}}
			</ng-container>
		</button>
	`,
} )

export class ScreenButtonComponent implements AfterViewInit{

	@Input() btn:BtnData | undefined;

	@HostBinding( 'class' ) get cssClass(){
		if( !this.btn )
			return [ 'btn' ];

		return [
			'btn',
			this.btn.type,
			this.btn.hl ? 'hl' : '',
			this.btn.on ? 'on' : 'off',
		];
	};

	@HostBinding( 'attr' ) get dataAttributes(){
		if( !this.btn )
			return [];

		const attribs = {
			'data-btn-num': this.btn.num,
			'data-btn-row': this.btn.row - 1,
			'data-btn-col': this.btn.col - 1,
		};

		return attribs;
	};


	@Output() tap = new EventEmitter<BtnData>;
	@Output() longPress = new EventEmitter<BtnData>;

	@Input() longPressThreshold = 300;
	/** whether to trigger the event automatically, without second mouse/touch event*/
	@Input() longPressAuto = true;

	private _actionStart:number | undefined;
	private _actionTimeout:number | undefined;
	private _listenerCleanup:CallableFunction[] = [];

	private _actionHandled = false;
	private _wasJustTouched = false;

	private _wasTouchedTimeout:number | undefined;

	constructor(
		public el:ElementRef,
		private render:Renderer2,
	){ }

	public ngAfterViewInit():void{
		this.render.listen( this.el.nativeElement, 'touchstart', ( event ) => this.onTouchStart( event ) );
		this.render.listen( this.el.nativeElement, 'mousedown', ( event ) => this.onMouseDown( event ) );
	}


	public onTouchStart( $event:TouchEvent ){
		if( this._actionHandled )
			return;

		this._beginAction( $event );
		this._touchClickWorkaround();

		[
			this.render.listen( this.el.nativeElement, 'touchend', this._endAction.bind( this ) ),
			this.render.listen( this.el.nativeElement, 'touchcancel', this._cancelAction.bind( this ) ),
		]
			.map( cleanup => this._listenerCleanup.push( cleanup ) );
	}

	public onMouseDown( $event:MouseEvent ){
		if( this._actionHandled || this._wasJustTouched )
			return;

		this._beginAction( $event );

		[
			this.render.listen( this.el.nativeElement, 'mouseup', this._endAction.bind( this ) ),
			this.render.listen( this.el.nativeElement, 'mouseleave', this._cancelAction.bind( this ) ),
		]
			.map( cleanup => this._listenerCleanup.push( cleanup ) );
	}



	private _beginAction( $event:MouseEvent | TouchEvent ){
		this._actionHandled = true;

		if( $event.cancelable ){
			$event.preventDefault();
			$event.stopPropagation();
		}

		this._actionStart = Date.now();

		// automatically trigger long press
		if( this.longPress.observed && this.longPressAuto )
			this._actionTimeout = setTimeout( () => {
				if( !this._actionHandled )
					return;

				this._actionStart = undefined;
				this.longPress.emit( this.btn );
				this._cleanupListeners();
			}, this.longPressThreshold );
	}

	private _endAction( $event:MouseEvent | TouchEvent ){
		if( !this._actionHandled || !this._actionStart )
			return this._cancelAction( $event );


		// also cancel event if cursor/finger was moved out
		if( !this._insideElement( $event ) )
			return this._cancelAction( $event );

		const actionDuration = Date.now() - this._actionStart;
		if( this.longPress.observed
			&& actionDuration >= this.longPressThreshold
		){
			this.longPress.emit( this.btn );
		}else{
			this.tap.emit( this.btn );
		}

		this._cleanupListeners();
	}

	private _cancelAction( $event:MouseEvent | TouchEvent ){
		this._cleanupListeners();
	}

	private _cleanupListeners(){
		if( this._actionTimeout ){
			clearTimeout( this._actionTimeout );
			this._actionTimeout = undefined;
		}

		for( const cleanup of this._listenerCleanup )
			cleanup();
		this._listenerCleanup = [];

		this._actionStart = undefined;
		this._actionHandled = false;
	}


	/**
	 * prevent click double firing from touch event on some browsers
	 */
	private _touchClickWorkaround(){
		this._wasJustTouched = true;
		if( this._wasTouchedTimeout )
			clearTimeout( this._wasTouchedTimeout );

		this._wasTouchedTimeout = setTimeout( () => {
			this._wasJustTouched = false;
			this._wasTouchedTimeout = undefined;
		}, 500 );
	}

	/**
	 * determines if the event happened within this component's boundaries
	 */
	private _insideElement( $event:MouseEvent | TouchEvent | { clientX:number, clientY:number } ){

		let clientXY:[ number, number ] | undefined;
		if( 'touches' in $event ){
			const ev = $event as TouchEvent;
			clientXY = [ $event.changedTouches[0].clientX, $event.changedTouches[0].clientY ];
		}else{
			const ev = $event as MouseEvent;
			clientXY = [ $event.clientX, $event.clientY ];
		}

		try{
			const underPoint = document.elementsFromPoint( clientXY[0], clientXY[1] );
			for( const el of underPoint )
				if( el === this.el.nativeElement )
					return true;

		}catch( err ){
			console.warn( 'issue determining element overlap', $event );
		}

		return false;
	}
}

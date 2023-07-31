import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { IonicModule } from '@ionic/angular';

import { FloopView } from './floop.view';


describe( 'FloopComponent', () => {
	let component:FloopView;
	let fixture:ComponentFixture<FloopView>;

	beforeEach( waitForAsync( () => {
		TestBed.configureTestingModule( {
			declarations: [ FloopView ],
			imports: [ IonicModule.forRoot() ],
		} ).compileComponents();

		fixture = TestBed.createComponent( FloopView );
		component = fixture.componentInstance;
		fixture.detectChanges();
	} ) );

	it( 'should create', () => {
		expect( component ).toBeTruthy();
	} );
} );

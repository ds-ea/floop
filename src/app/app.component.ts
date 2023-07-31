import { Component } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { FloopModule } from './floop/floop.module';


@Component( {
  selector: 'app-root',
  standalone: true,
  imports: [ IonicModule, FloopModule ],
  template: `
	  <ion-app>
		  <ion-router-outlet></ion-router-outlet>
	  </ion-app>
  `,
} )
export class AppComponent{
  constructor(){}
}

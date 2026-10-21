/* ------------------------------------------------------------------
One DomObserver for the module's components: runs a callback for
elements matching a selector now and whenever the CMS adds more
(the CMS loads its panels with ajax and react)
------------------------------------------------------------------ */

import DomObserverController from 'domobserverjs';

export default new DomObserverController();

/* global axios */

/* global Hammer */

/* global JsBarcode */

// Axios object to access server 

var server = axios.create({
		headers: { "Content-Type": "application/json" },
//		baseURL: 'DOCUMENT_API_URL'
		baseURL: 'https://2eaclsw0ob.execute-api.eu-west-1.amazonaws.com/Prod' // (Test subscription 379 context 550)
	}); 
	
	
// Add a request interceptor
server.interceptors.request.use(function (config) {
        let blocker = document.getElementById('blocker');	
        blocker.style.display = 'block';
        return config;
    }, function (error) {
        return Promise.reject(error);
    });

// Add a response interceptor
server.interceptors.response.use(function (response) {
        let blocker = document.getElementById('blocker');	
        blocker.style.display = 'none';
        return response;
    }, function (error) {
        return Promise.reject(error);
    });	
	
function bind(element, datum) {
    
    let elements = element.querySelectorAll('div[data-field-name]');
    for (let element of elements) {
        element.innerHTML = '';
    }
    
    for (let fieldName in datum) {
        let value = datum[fieldName];
        if (typeof value === 'object') {
            for (let nestedFieldName in value) {
                let field = element.querySelector('[data-field-name="' + fieldName + '.' + nestedFieldName + '"]');
                if (field != null) {
                    field.innerHTML = value[nestedFieldName];
                }
            }            
        } else {
            let field = element.querySelector('[data-field-name="' + fieldName + '"]');
            if (field != null) {
                if (value != null) {
                    field.innerHTML = value; 
                } else {
                    field.innerHTML = '';
                }
            } 
        }
    }
} 

function bindToTable(table, template, data, onclick) {
    
    // Remove rows from the table
    
    while (table.firstChild) {
        table.removeChild(table.lastChild);
    }
    
    // Insert new rows into the table
    
    for (let i = 0; i < data.length; i++) {
        let datum = data[i];
        let row = template.cloneNode(true);
        row.classList.remove('template');        
        bind(row, datum);
        table.appendChild(row);
        row.onclick = () => {
            onclick(datum);
        };
    }
}

/**
 * Top level state
 */
class State {
    
    static init(view) {
        this.view = view;
    }
    
    static async enter() {
		let old = document.querySelector('div.view[current]');
		if (old != null) {
			old.style.display = 'none';
			old.removeAttribute('current');
		}
		this.view.style.display = 'block';
		this.view.setAttribute('current', 'true');
    }

}

/**
 * A state related to a line in an array that offers browsing back and forth.
 */
class LineState extends State {
    
    static async next(list, lines) {
        console.log("You must implement next method.");
    }

    static async previous(list, lines) {
        console.log("You must implement previous method.");
    }
    
    static async enter(list, lines) {

		await super.enter();        
		
		Storage.persist(list.documentType, list);

		let line = lines[list.index];
        bind(this.view, line);
        
		let optionsPanel = this.view.querySelector('#optionsPanel');
		optionsPanel.style.display = 'none';

        let next = async (e) => {
			e.preventDefault();
			await this.next(list, lines);
        };
        
        let previous = async (e) => {
			e.preventDefault();
			await this.previous(list, lines);
        };
        
        let hammer = new Hammer(this.view, { taps: 2 });
        hammer.on("swipeleft", next);
        hammer.on("swiperight", previous);

        let previousButton = this.view.querySelector('button[data-action="previous"]');
        if (list.index > 0) {     
    		previousButton.disabled = false;
    		previousButton.onclick = previous;
        } else {
            previousButton.disabled = true;
        }
		
        let nextButton = this.view.querySelector('button[data-action="next"]');
        if (list.index < lines.length - 1) {
    		nextButton.disabled = false;
    		nextButton.onclick = next;
        } else {
            nextButton.disabled = true;
        }

		let optionsButton = this.view.querySelector('button[data-action="options"]');
		optionsButton.onclick = () => {
			if (optionsPanel.style.display == 'none') {
				optionsPanel.style.display = 'block';
			} else {
				optionsPanel.style.display = 'none';
			}
		};
		
		let pauseButton = this.view.querySelector('button[data-action="pause"]');
        pauseButton.onclick = async () => {
            StartState.enter();
        };
		
		this.view.querySelector('#lineIndexField').innerHTML = list.index + 1;
		this.view.querySelector('#lineCountField').innerHTML = lines.length;

    }    
        
}

/**
 * Storing of objects in local storage
 */ 
class Storage {
    
    static persist(key, object) {
        window.localStorage.setItem(key, JSON.stringify(object));            
    }
    
    static load(key) {
		let s = window.localStorage.getItem(key);
		if (s == null) {
			return null;	
		}
        return JSON.parse(s);
    }

	static clear(key) {
		window.localStorage.removeItem(key);
	}
}

/**
 * State showing pending picking lists for the user to choose.
 */ 
class PickingListsState extends State {
    
    static async enter() {
	
		await super.enter();
	        
        let response = await server.get('/pendingMultiPickingLists');
        let pickingLists = response.data;

        let table = this.view.querySelector('.table[data-table-name="pickingListTable"]');
        let row = this.view.querySelector('.table-row.template[data-table-name="pickingListTable"]');
        
        let choose = async (pickingList) => {
            
            pickingList.workStatus = 'ON_GOING';
            let response = await server.put('/multiPickingLists/' + pickingList.id, pickingList, { validateStatus: function (status) {
        		    return status == 200 || status == 422; 
        		}});
        	
        	if (response.status == 422) {
	
                window.alert(response.data.messageText);

        	} else {
        	
        	    let multiPickingList = response.data;

                // Mark all lines as not done
    
                let lines = multiPickingList.shipmentLinesToPack;
                for (let i = 0; i < lines.length; i++) {
                    lines[i].done = false;
                }
    
                if (lines.length == 0) {
                    window.alert('Der er ingen linjer til plukning på denne liste.');
                } else {
                    multiPickingList.index = 0;
    				await LineToPickState.enter(multiPickingList, lines, 0);
                }
                
        	}
        };
        
        let refreshButton = this.view.querySelector('button[data-action="refresh"');
        refreshButton.onclick = async () => {
                await PickingListsState.enter();            
            };

        let menuButton = this.view.querySelector('button[data-action="menu"');
        menuButton.onclick = async () => {
                await StartState.enter();
            };

        let resumeButton = this.view.querySelector('button[data-action="resume"');
        let multiPickingList = Storage.load('MULTI_PICKING_LIST');
        if (multiPickingList != null) {
    		resumeButton.disabled = false;
        } else {
            resumeButton.disabled = true;
        }
        resumeButton.onclick = async () => {
                let lines = multiPickingList.shipmentLinesToPack;
                let index = multiPickingList.index;
    			if (lines[index].done) {
                    await LinePickedState.enter(multiPickingList, lines, index);               
    			} else {
                    await LineToPickState.enter(multiPickingList, lines, index);               
    			}
            };

        bindToTable(table, row, pickingLists, choose);

    }

}

/**
 * A picking line
 */ 
class PickLineState extends LineState {
    
    static async next(multiPickingList, lines) {
        if (multiPickingList.index < lines.length - 1) {
			multiPickingList.index++;
			if (lines[multiPickingList.index].done) {
                await LinePickedState.enter(multiPickingList, lines);               
			} else {
                await LineToPickState.enter(multiPickingList, lines);               
			}
        }
    }
    
    static async previous(multiPickingList, lines, index) {
        if (multiPickingList.index > 0) {
            multiPickingList.index--;
			if (lines[multiPickingList.index].done) {
				await LinePickedState.enter(multiPickingList, lines);	
			} else {
                await LineToPickState.enter(multiPickingList, lines);
			}
        }
    }

}

/**
 * Showing line that has already been picked.
 */ 
class LinePickedState extends PickLineState {

    static async enter(multiPickingList, lines) {
        
        await super.enter(multiPickingList, lines);

        let undo = async () => {
            lines[multiPickingList.index].done = false;   
            LineToPickState.enter(multiPickingList, lines);
        };
        
        let undoButton = this.view.querySelector('button[data-action="undo"]');
        undoButton.onclick = undo;

    }
    
}

/**
 * Showing line to pick.
 */ 
class LineToPickState extends PickLineState {
    
    static async enter(multiPickingList, lines) {
        
        await super.enter(multiPickingList, lines);

        let confirm = async () => {
            
            lines[multiPickingList.index].done = true; 

            let i = 0;
            let found = false;
            while (i < lines.length && !found) {
                let line = lines[i];
                if (!line.done) {
                    found = true;
                } else {
                    i++;
                }
            }
            
            if (found) {
                multiPickingList.index = i;
                await LineToPickState.enter(multiPickingList, lines);
            } else {
                multiPickingList.workStatus = 'DONE';
	            await server.put('/multiPickingLists/' + multiPickingList.id, multiPickingList);
                Storage.clear('MULTI_PICKING_LIST');
				await PickingListsState.enter();
            }
            
        };
        
        let postpone = async () => {
            let postponedLines = lines.splice(multiPickingList.index, 1);
            lines.push(postponedLines[0]);
            
            let i = 0;
            let found = false;
            while (i < lines.length && !found) {
                let line = lines[i];
                if (!line.done) {
                    found = true;
                } else {
                    i++;
                }
            }
    
            LineToPickState.enter(multiPickingList, lines, i);
        };
        
        let confirmButton = this.view.querySelector('button[data-action="confirm"]');
        confirmButton.onclick = confirm;

        let postponeButton = this.view.querySelector('button[data-action="postpone"]');
        postponeButton.onclick = postpone;
        

    }
}


/**
 * Show start view
 */ 
class StartState extends State {
    
    static async enter() {
        await super.enter();
        let pickingButton = this.view.querySelector('button[data-action="picking"');
        pickingButton.onclick = async () => {
                await PickingListsState.enter();           
            };

    }
}

/**
 * The app itself.
 */ 
class App {
    
    static init(views) {
        StartState.init(views[0]);
        PickingListsState.init(views[1]);
        LineToPickState.init(views[2]);
        LinePickedState.init(views[3]);
    }
    
    static async start() {
        await StartState.enter();
    }
}



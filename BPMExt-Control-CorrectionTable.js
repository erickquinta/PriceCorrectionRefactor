bpmext_control_InitCorrectionTable = function(domClass)
{
 	this._instance = {
		offset: 0,
	};

	if (!this.constructor.prototype._proto)
	{
		this.constructor.prototype._proto =
		{
			//>> Performance hacks /////////////////////////////////////////////////////////////////////
			fixTable: function(view, table, globalSelCallback)
			{
				//Safeguard to prevent fixing Table's prototype multiple times
				if(table.constructor.prototype.appendRecords2)
					return;
				
				//Table workaround to prevent constant reloading of rows when records are added
				table.constructor.prototype.refreshStats = function()
				{
					this._proto._refreshTableStats(this);
					this._proto._refreshPaginationStatus(this);					
				}
				
				//Added appendRecords2 method - allows appending multiple records without causing
				//a reload every time, and uses flag to trigger the table to refresh its internal
				//paging state at the end
				table.constructor.prototype.appendRecords2 = function(records, finalize)
				{
					var fnRef = this.constructor.prototype._proto._reloadList;
					var view = this;
					
					try
					{
						//Temporarily replacing reload w/ NOOP 
						this.constructor.prototype._proto._reloadList = function(){};
						//Appending the records to the table (now computationally cheaper)
						this.appendRecords(records);
					}
					finally
					{
						//Restoring original function reference
						setTimeout(function(){view.constructor.prototype._proto._reloadList = fnRef});
					}
					
					if(finalize)
					{
						setTimeout(function(){
							view.refreshStats();					
						});
					}
				}
				
				//Table has no event handler for global selection (that's a huge oversight)
				//This provides a hook to handle global selection changes
				if(globalSelCallback != null)
				{
					var globalSelCbx = table.context.element.querySelector(".SelCtl input");
					
					globalSelCbx.addEventListener("change", globalSelCallback);
				}
			},
			//<< Performance hacks /////////////////////////////////////////////////////////////////////
			//>> Utilities /////////////////////////////////////////////////////////////////////////////
			/*
				Get the first child Coach view directly under a parent Coach View
			*/
			getChildView: function(view, parentCV)
			{
				for(var subviewId in parentCV.context.subview)
				{
					var childCV = parentCV.context.getSubview(subviewId);
					
					if(childCV == null)
						break;
					
					if(childCV.length == 0)
						break;
					
					return childCV[0];
				}
			},
			/*
				Gets all child Coach view directly under a parent Coach View
			*/
			getChildViews: function(view, parentCV)
			{
				var res = [];
				
				for(var subviewId in parentCV.context.subview)
				{
					var childCV = parentCV.context.getSubview(subviewId);
					
					if(childCV == null)
						break;
					
					for(var i = 0; i < childCV.length; i++)
					{
						res.push(childCV[i]);
					}
				}
				
				return res;
			},
			searchTable: function(view){ 
				var searchItems = view.ui.get("Criteria").getData().items;
				var includeAdbill = view.ui.get("IncludeAdbill").isChecked();
				var includeNetChange = view.ui.get("IncludeNetChange").isChecked();
				var showLockedRows = view.ui.get("ShowLockedRows").isChecked();
				
				view.ui.get("Table").search(function(listItem){
				
					var rebillAmt = listItem.rebillQty * listItem.newPrice;
					var creditAmt = listItem.rebillQty * listItem.oldPrice;
					
					if(!includeAdbill){
						if(rebillAmt>creditAmt){
							return false;
						}
					}
					
					if(!includeNetChange){
						if((listItem.oldLead == listItem.newLead) && (listItem.oldBid == listItem.newBid) && (listItem.oldConRef == listItem.newConRef) && (listItem.oldCbRef == listItem.newCbRef)){
							return false;
						}
					}
					
					if(!showLockedRows){
						if(listItem.isLocked){
							return false;
						}
					}
					
					for(var i = 0; i < searchItems.length; i++){
						var columnName = searchItems[i].columnNameValue;
						var listItemVal = listItem[columnName];
												
						var searchValue;
						
						// check if string or numeric
						if(searchItems[i].searchValueText && searchItems[i].searchValueText != null && searchItems[i].searchValueText != undefined){			
							listItemVal = listItemVal.toLowerCase();
							
							searchValue = searchItems[i].searchValueText.trim();
							searchValue = searchValue.toLowerCase();
						}else if(searchItems[i].searchValueDecimal != null && searchItems[i].searchValueDecimal != undefined){
							searchValue = searchItems[i].searchValueDecimal;
						}
						
						// NO OPERATOR  // date type // 
						// straight comparison between listItem and search value
						if(!searchItems[i].operator || searchItems[i].operator == null || searchItems[i].operator == undefined){			
							if (columnName == "pricingDate" || columnName == "createdOn"){
								var searchFromDate = new Date(view._proto.dateTerms(searchItems[i].searchValueDateFrom, true)); // convert to YYYY-MM-DDT00:00:00.000Z
								var searchToDate = new Date(view._proto.dateTerms(searchItems[i].searchValueDateTo, true)); // convert to YYYY-MM-DDT00:00:00.000Z
								// Must be of format YYYY-MM-DDT00:00:00.000Z with zeroed out time component in UTC (Z) timezone
								// Reformatting to ensure all dates have zeroed out time component
								var listItemDate = new Date(view._proto.dateTerms(new Date(Date.parse(listItem[columnName])), true)); 
								
								if (listItemDate.getTime() < searchFromDate.getTime() || listItemDate.getTime() > searchToDate.getTime()){
									return false;
								}
							}		
						}
						// WITH OPERATOR //
						else if(searchItems[i].operator && searchItems[i].operator != null && searchItems[i].operator != undefined){
							switch(searchItems[i].operator){
								case "==":
									// multiple entries
									if(columnName == "invoiceId" || columnName == "materialId" || columnName == "customerId"){
										var multiples = searchValue.split("\n");
										var multipleFound = false;
										
										for (var j=0; j<multiples.length; j++){
																	
											if ((""+multiples[j]).trim() == listItemVal){
												multipleFound = true;
												break;
											}
										}
										if(multipleFound == false){
											return false;
										}
									}
									// string/numeric
									else{
										if(searchItems[i].searchValueText && searchItems[i].searchValueText != null && searchItems[i].searchValueText != undefined){			
											if(!listItemVal.includes(searchValue)){
												return false;
											}
										}else if(searchItems[i].searchValueDecimal != null && searchItems[i].searchValueDecimal != undefined){
											if(listItemVal != searchValue){
												return false;
											}
										}
									}
								break;
								
								case ">=":
									if(listItemVal < searchValue){
										return false;
									}
								break;
								
								case "=<":
									if(listItemVal > searchValue){
										return false;
									}
								break;
								
								case ">":
									if(listItemVal <= searchValue){
										return false;
									}
								break;
									
								case "<":
									if(listItemVal >= searchValue){
										return false;
									}
								break;
								
								case "!=":
									// multiple entries
									if(columnName == "invoiceId" || columnName == "materialId" || columnName == "customerId"){
										var multiples = searchValue.split("\n");
										var multipleFound = false;
										
										for (var j=0; j<multiples.length; j++){
																	
											if ((""+multiples[j]).trim() == listItemVal){
												multipleFound = true;
												break;
											}
										}
										if(multipleFound == true){
											return false;
										}
									}
									// string/numeric
									else{
										if(searchItems[i].searchValueText && searchItems[i].searchValueText != null && searchItems[i].searchValueText != undefined){			
											if(listItemVal == searchValue){
												return false;
											}
										}else if(searchItems[i].searchValueDecimal && searchItems[i].searchValueDecimal != null && searchItems[i].searchValueDecimal != undefined){
											if(listItemVal == searchValue){
												return false;
											}
										}
									}
								break;
							}
						}
					}
					
					return true;
				});
				view._instance.table.setAllRecordsSelected(false, false);
				view.ui.get("Search_Modal").hide(true);	
			},
			clearSearchFilters: function(view){
				view.ui.get("Table").clearSearch();
				view.ui.get("Criteria").clear();
				view.ui.get("Search_Modal").hide(true);
				view._proto.searchTable(view);
			}, 
			/*
				Utility logic to retrieve a record by id.
				This avoids the ongoing cost of iterating through records to find one matching an id
			*/
			getMappedRecord: function(view, id)
			{
				//Lazy-create id to record mappings
				if(view._instance.idMap == null)
				{
					var data = view._instance.table.getRecords();
					var len = data.length;
					
					view._instance.idMap = {};
					
					for(var i = 0; i < len; i++)
					{
						dataElt = data[i];
						view._instance.idMap[dataElt.id] = dataElt;
					}
				}
				
				return view._instance.idMap[id];
			},
			/*
				Resets the record map (called when running a line item query)
			*/
			resetMappedRecords: function(view)
			{
				delete view._instance.idMap;
			},
			//<< Utilities /////////////////////////////////////////////////////////////////////////////
			//>> Query and progress tracking ///////////////////////////////////////////////////////////
			/*
				Stop next query phase from running
			*/
			cancelRequest: function(view)
			{
				view._instance.cancelled = true;
			},
			setProgressActive: function(view, active)
			{
				view._instance.progressCtl.context.options.active.set("value", active);
			},
			setProgress: function(view, progress)
			{
				if(progress == null)
					progress = 0;
				
				var max = view._instance.progressCtl.context.options.maxValue.get("value");

				view._instance.progressCtl.setProgress(progress);
				view._instance.progressBadgeCtl.setText(Math.round(progress / max * 100) + "%");
			},
			/*
				Bootstraps a record with backing methods to to facilitate associating
				a record property with a DOM element representing it
			*/
			setupDataToVisualElements: function(view, record)
			{
				var map = {};
				
				record.getVisualElement = function(propName)
				{
					return map[propName];
				}
				
				record.setVisualElement = function(view, propName, elt)
				{
					map[propName] = elt;
				}
			},
			/*
				Sets the value of a DOM element
			*/
			setElementValue: function(view, propName, elt, value)
			{
				if(value != null)
				{
					elt.innerHTML = view.context.htmlEscape(value); //Escape value for XSS protection
				}
				else
				{
					elt.innerHTML = "";
				}
			},
			/*
				Sets the value of a record property (and fires totals recalculation)
			*/
			setRecordPropValue: function(view, record, propName, value)
			{
				//Set new value in record
				record[propName] = value;
				
				//Recompute total associated with this record property
				this.calculateSelectedTotals(view, propName);
			},
			/*
				Adds click support on a DOM element for in-place editing
			*/
			setupChangeHandler: function(view, type, record, propName, elt, rowId)
			{
				elt.onclick = function()
				{
					view._proto.showValueEditor(view, type, record, propName, elt, rowId);
				}
			},
			//>> Table value editing ///////////////////////////////////////////////////////////////////
			/*
				Display in-place edit field in the place of the DOM element to be edited
			*/
			showValueEditor: function(view, type, record, propName, editedElt, rowId)
			{
				if(view._instance.editor != null)
					throw new Error("Editor already in use");
				
				//Assumes editor CV naming convention <type>Editor
				var editorId = type + "Editor";
				var editorCV = view.ui.get(editorId); //Get editor CV matching the type

				if(editorCV == null)
				{
					throw new Error("Editor [" + editorId + "] not found");
				}
				
				//Setup the editing context
				view._instance.edit = {
					domElt: editedElt,
					editorCV: editorCV,
					propName: propName,
					record: record,
					rowId: rowId
				}
				var newVal = editedElt.innerHTML;
				newVal = Number(newVal.replace(/[^0-9\.-]+/g,""));
				editorCV.setData(newVal);
				editedElt.parentElement.insertBefore(editorCV.context.element, editedElt);
				domClass.add(editedElt, "editing");
				
				setTimeout(
					function(){view._instance.edit.editorCV.focus()}, 
					100
					);
			},
			/*
				Saves the value entered in the edit field to the record and the DOM element
				and moves the edit CV back to the edit field "pool"
			*/
			resetValueEditor: function(view)
			{
				if(view._instance.edit != null)
				{
					var editorBox = view.context.element.querySelector(".value-editors");
					var value = view._instance.edit.editorCV.getData();
					var type = view._instance.edit.editorCV.context.options._metadata.helpText.get("value");

					editorBox.appendChild(view._instance.edit.editorCV.context.element);
					domClass.remove(view._instance.edit.domElt, "editing");
					
					//Update the value in the data record backing the table row
					this.setRecordPropValue(
						view,
						view._instance.edit.record,
						view._instance.edit.propName,
						value
						);
					
					//format the value
					if(view._instance.edit.domElt.__originalVal != value){
						this.addChangedStyle(view);
					}	
					if(type == "decimal"){	
						value = view._proto.dollarTerms(value);
					}else if(type == "percent"){
						value = view._proto.percentTerms(value);
					}
					//Update the value in the DOM element in the cell
					this.setElementValue(
						view, 
						view._instance.edit.propName, 
						view._instance.edit.domElt, 
						value
					);
					
					delete view._instance.edit;
				}
			},
			undoChanges: function(view, row, record, domElt){
				for(var i = 0; i < row.childNodes.length; i++){
					var tdItem = row.childNodes[i];
					
					if(tdItem.lastElementChild){
						if(tdItem.lastElementChild.hasOwnProperty("__originalVal")){
							if(tdItem.lastElementChild.hasOwnProperty("__propName")){
								var propName = tdItem.lastElementChild.__propName; 
								var domElm = tdItem.getElementsByClassName("editableField")[0];
								var type = domElm.classList[1];
								
								this.setRecordPropValue(
									view,
									record,
									propName,
									tdItem.lastElementChild.__originalVal
								);
								var originalVal = tdItem.lastElementChild.__originalVal;

								if(type == "decimal"){	
									originalVal = view._proto.dollarTerms(originalVal);
								}else if(type == "percent"){
									originalVal = view._proto.percentTerms(originalVal);
								}

								this.setElementValue(
									view, 
									propName, 
									domElm, 
									originalVal
								);
							}
								
						}
					}	
				}
				record.isChanged = false;
				row.classList.remove('editedRow');				
				var btnId = 'undoBtn' + row.id;
				var btn = document.getElementById(btnId);
				btn.remove();
			},
			addChangedStyle: function(view){
				if(!view._instance.edit.record.isChanged){
					view._instance.edit.record.isChanged = true;
					var row = document.getElementById(view._instance.edit.rowId);
					var record = view._instance.edit.record;
					var domElt = view._instance.edit.domElt; //document.getElementsByClassName("editableField" + row.id);
					
					document.getElementById(view._instance.edit.rowId).classList.add('editedRow');
					
					var undoBtn = document.createElement("button");
					var btnId = 'undoBtn' + row.id;
					
					undoBtn.setAttribute('id', btnId);
					undoBtn.onclick = function(){
						view._proto.undoChanges(view, row, record, domElt);
					}
					var span = document.createElement("span");
					domClass.add(undoBtn, "btn btn-info btn-xs");
					domClass.add(span, "btn-label icon fa fa-undo");
					undoBtn.appendChild(span);
					
					var td = document.getElementById(view._instance.edit.rowId).childNodes[1];
					td.appendChild(undoBtn);
				}
			},
			onLineItemsResult: function(view, result)
			{	
				if(result.length != 0)
				{
					//view._instance.totalCount = result.totalCount;
					view._instance.progressCtl.setMaximum(view.context.options.totalRecords.get("value"));
				}

				view._instance.offset += view.context.options.numRecords.get("value");
				
				var allRecsLoaded = view._instance.offset >= view.context.options.totalRecords.get("value");
				view._instance.table.appendRecords2(result, allRecsLoaded);
				
				setTimeout(function(){
					if(!allRecsLoaded)
					{	
						view._proto.setProgress(view, view._instance.offset);
						
						if(!view._instance.cancelled)
						{
							view._proto.getCorrectionRows(view);
						}
						else
						{
							delete view._instance.cancelled;
							view._proto.setProgressActive(view, false);
							view._instance.table.refreshStats();
						}
					}				
					else
					{	// no more records to get					
						view._instance.offset = 0;
						view._proto.setProgress(view, view.context.options.totalRecords.get("value"));
						view._proto.setProgressActive(view, false);
						view.ui.get("Button_Layout").setEnabled(true);
						view._proto.searchTable(view);
						setTimeout(function(){
							view.ui.get("ProgressIcon").setVisible(false); 
							view.ui.get("Progress").setVisible(false);
							view.ui.get("ProgressBadge").setVisible(false);
						}, 1500);
					}
				});
			},
			getCorrectionRows: function(view){
				if(view._instance.offset == 0)
				{
					view._proto.setProgress(view, 0);
					this.resetMappedRecords(view);
					view._instance.table.clear();
				}
				var input = {processInstanceId: view.context.options.processInstanceId.get("value"),
							lockRequestId: view.context.options.lockRequestId.get("value"),
							numRecords: view.context.options.numRecords.get("value"),
							totalRecords: view.context.options.totalRecords.get("value"),
							rowIndex: view._instance.offset
							};
							
				var serviceArgs = {
					params: JSON.stringify(input),
					load: function(data) {
						view._proto.onLineItemsResult(view, data.correctionRow.items)
					},
					error: function(e) {
						
					}
				}
				view._proto.setProgressActive(view, true);
				view.context.options.taskDataService(serviceArgs);
			},
			/*
				Empties an update field
			*/
			/*clearUpdateField: function(view, inputGroup)
			{
				var childCV = this.getChildView(view, inputGroup);
				
				if(childCV != null)
					childCV.setData(null);
			},*/
			/*
				Opens the update modal dialog if as least 1 record is selected
			*/
			openRecordUpdateDialog: function(view)
			{
				if(view.ui.get("Table").getSelectedRecordCount(true) > 0)
				{
					view.ui.get("Mass_Update_Modal").setVisible(true);
				}
			},
			/*
				Updates the selected record(s) with the updated values specified in the update dialog 
			*/
			updateRecords: function(view)
			{
				var selected = view.ui.get("Table").getSelectedRecords(true);
				var section = view.ui.get("UpdateFieldHolder");
				var hLayouts = [];
				var vLayouts = this.getChildViews(view, section);
				var propNameList = [];
				
				for(var i = 0; i < vLayouts.length; i++){
					var current = vLayouts[i];
					for(var subviewId in current.context.subview){
						var hl = current.context.getSubview(subviewId)[0];
						var subCV = this.getChildView(view, hl);
						var propName = subCV.context.options._metadata.helpText.get("value");
						
						for(var j = 0; j < selected.length; j++){
							var sel = selected[j];
							var value;
							
							if(subCV.isEnabled()){
								subCV.getData() || subCV.getData() == 0 ? value = subCV.getData() : value = sel[propName];
							}else if(!subCV.isEnabled()){
								value = null;
							}
							sel[propName] = value;
							
							if(!sel.getVisualElement)
								continue;
							
							var elt = sel.getVisualElement(propName);
							
							if(elt == null)
								continue;

							var td = elt.parentElement;
							var rowId = td.parentElement.id;
							
							view._instance.edit = {
								record: sel,
								rowId: rowId
							}
							var type = elt.classList[1];
							if(type == "decimal"){	
								value = view._proto.dollarTerms(value);
							}else if(type == "percent"){
								value = view._proto.percentTerms(value);
							}

							this.setElementValue(view, propName, elt, value);
							this.addChangedStyle(view);
							
							// ?
							delete view._instance.edit;
						}
						subCV.setData(null); //Reset the field to null so it's empty next time						
					}
				}
				
				view.ui.get("Mass_Update_Modal").setVisible(false, true);
				//view._instance.table.setAllRecordsSelected(false, true);
			},
			calculateSelectedTotals: function(view){
				var selected = view._instance.table.getSelectedRecords(false);
				var ctx = {};
				
				if(selected != null && selected.length > 0){
					var totals = {};
					totals.selectedCreditTotal = 0;
					totals.selectedRebillTotal = 0;
					totals.selectedNetDiff = 0; // totals.selectedRebillTotal - totals.selectedCreditTotal;
					totals.selectedCBTotal = 0;
					totals.selectedLineCount = 0;
					
					for(var i = 0; i < selected.length; i++){
						totals.selectedCreditTotal += selected[i].oldPrice * selected[i].rebillQty;
						totals.selectedRebillTotal += selected[i].newPrice * selected[i].rebillQty;
						totals.selectedLineCount++; // Atleast 1 line is present for this group
						
						//DEFECT ON selected[i].newNoChargeBack.trim() == ""
						if (selected[i].newNoChargeBack == null) {
							totals.selectedCBTotal += ((selected[i].newChargeBack - selected[i].oldChargeBack) * selected[i].rebillQty);	
						}
					}
					totals.selectedNetDiff = totals.selectedCreditTotal - totals.selectedRebillTotal;
					
					view.ui.get("Selected_Credit_Total").setData(totals.selectedCreditTotal);
					view.ui.get("Selected_Rebill_Total").setData(totals.selectedRebillTotal);
					view.ui.get("Selected_Net_Difference").setData(totals.selectedNetDiff);
					view.ui.get("Selected_CB_Total").setData(totals.selectedCBTotal);
					view.ui.get("Selected_Lines_Count").setData(totals.selectedLineCount);
				}
			},
			groupByCalc: function(view){
				var tabIndex = view.ui.get("TotalTab").getCurrentPane();
				var items = view._instance.table.getRecords();
				
				var GroupBytbl; // The table specific to each tab
				var groupType; // data element that distinguishes the summary group
				var groupName; // display name of data element
				var eventName;
				
				switch (tabIndex){
					case 0:
						view.ui.get("Credit_Total").recalculate();
						view.ui.get("Rebill_Total").recalculate();
						view.ui.get("CB_Total").recalculate();
						view._proto.calculateSelectedTotals(view);
						return;
					case 1:
						GroupBytbl = view.ui.get("CustomerGroupBy/Table1");
						groupType = "customerId"; //data element name
						groupName = "customerName";
						eventName = "CUS_MAT_SUM";
						break;
					case 2:
						GroupBytbl = view.ui.get("SupplierGroupBy/Table1")
						groupType = "supplierId";  //data element name
						groupName = "supplierName";
						eventName = "SUPPLIER_SUM";
						break;
					case 3:
						GroupBytbl = view.ui.get("MaterialGroupBy/Table1");
						groupType = "materialId"; //data element name
						groupName = "materialName";
						eventName = "CUS_MAT_SUM";
						break;
					default:
						return;
				};
				if(items){
					var mapGroup = new Map();
					if (groupType == "supplierId") {
						for(var i = 0; i < items.length; i++) {	
							var summary = {};
							summary.groupBy = items[i][groupType];
							summary.displayName = items[i][groupType] + " " + items[i][groupName];
							summary.oldChargebackTotal = 0;
							summary.newChargebackTotal = 0;
							if (items[i].oldNoChargeBack == "X") { // X means checked in SAP CRM; reversed for testing
								summary.oldChargebackTotal = 0;
								summary.oldNoChargebackCount = 1;
							}
							else {
								summary.oldChargebackTotal = items[i].oldChargeBack * items[i].rebillQty;
								summary.oldNoChargebackCount = 0;
							}
							if (items[i].newNoChargeBack == "X") { // X means checked in SAP CRM; reversed for testing
								summary.newChargebackTotal = 0;
								summary.newNoChargebackCount = 1;
							}
							else {
								summary.newChargebackTotal = items[i].newChargeBack * items[i].rebillQty;
								summary.newNoChargebackCount = 0;
							}
							summary.lineCount = 1; // Atleast 1 line is present for this group
							summary.chargebackTotal = (items[i].newChargeBack - items[i].oldChargeBack) * items[i].rebillQty;

							// Check if record already exists for that customer
							var temp = mapGroup.get(summary.groupBy);
							if (temp) {
								temp.oldChargebackTotal += summary.oldChargebackTotal;
								temp.newChargebackTotal += summary.newChargebackTotal;
								temp.oldNoChargebackCount += summary.oldNoChargebackCount;
								temp.newNoChargebackCount += summary.newNoChargebackCount;
								temp.chargebackTotal += summary.chargebackTotal;
								temp.lineCount += summary.lineCount;
								mapGroup.set(summary.groupBy, temp);
							}
							else {
								mapGroup.set(summary.groupBy, summary);
							}
						}
					}
					else {
						for(var i = 0; i < items.length; i++) {		
							var summary = {};
							summary.groupBy = items[i][groupType];
							summary.displayName = items[i][groupType] + " " + items[i][groupName];
							summary.creditTotal = items[i].oldPrice * items[i].rebillQty;
							summary.rebillTotal = items[i].newPrice * items[i].rebillQty;
							summary.netDiff = summary.creditTotal - summary.rebillTotal;
							summary.lineCount = 1; // Atleast 1 line is present for this group
							// Calc chargeback 
							if (items[i].newNoChargeBack) {
								summary.chargebackTotal = 0; // Should not be undefined even if any particular line has newNoChargeBack flag set
							}
							else {
								summary.chargebackTotal = (items[i].newChargeBack - items[i].oldChargeBack) * items[i].rebillQty;
							}
							// Check if record already exists for that customer
							var temp = mapGroup.get(summary.groupBy);
							if (temp) {
								temp.creditTotal += summary.creditTotal;
								temp.rebillTotal += summary.rebillTotal;
								temp.netDiff += summary.netDiff;
								temp.chargebackTotal += summary.chargebackTotal;
								temp.lineCount += summary.lineCount;
								mapGroup.set(summary.groupBy, temp);
							}
							else {
								mapGroup.set(summary.groupBy, summary);
							}
						}
					}
					var sums = []
					mapGroup.forEach(function(value){
						sums.push(value);
						});
					bpmext.ui.publishEvent(eventName, sums);
				}

			},
			simulatePrice: function(view){
				if (view.ui.get("Table").getSelectedIndices().length > 0){
				
					var rows = view.ui.get("Table").getSelectedRecords(true);
					var priceSimMaxLength = view.context.options.priceSimMaxLength.get("value");
					if (rows.length > priceSimMaxLength) {
						//this.populateModalAlerts("overPriceSimulation", priceSimMaxLength);
						return false;
					}
					else {
						view._proto.setProgressBar(view, true);
						var selected = view.ui.get("Table").getSelectedRecords(true); //mix-match work-around to counter 'myList.get("listAllSelectedIndices")' not taking into account filtered table results
						var list = view.ui.get("Table").getRecords();
						var indices = view.ui.get("Table").getSelectedIndices()
						var selectedRowsWithVals = [];
						if (indices && indices.length > 0) {
							for (var i = 0; i < indices.length; i++) {
								for (var j = 0; j < selected.length; j++) {
									if (selected[j].invoiceId == list[indices[i]].invoiceId && selected[j].invoiceLineItemNum == list[indices[i]].invoiceLineItemNum && list[indices[i]] != null && !list[indices[i]].isLocked){
										selectedRowsWithVals.push(list[indices[i]]);   
										break;                                            
									}
								}
							}
						}
						var input = {
							selectedCorrectionRowsJSON: JSON.stringify(selectedRowsWithVals),
							instanceId: "1722", //view.context.bpm.system.instanceId, //using the 'bpm' context, using the options context variable was bringing unnecessary metadata with it
							isUseOldValues: false //flag to let API know whether this call is being invoked as a background operation (== true) before 'Correct Price' or by user on 'Correct Price' UI (== false)
						};
						var serviceArgs = {
							params: JSON.stringify(input),
							load: function(data) {
								var returned = JSON.stringify(data);
								view._proto.setProgressBar(view, false);
								console.log("data: ", data.selectedCorrectionRows.correctionRows.items[0])
								var indexedResults = data.selectedCorrectionRows.results.items;
								var simulatedRows = data.selectedCorrectionRows.correctionRows.items;
								if (view._proto.checkForSimFailures(view, indexedResults, simulatedRows)) {
									//var correctionData = _this.context.binding.get("value");
									for (var i = 0; i < selected.length; i++) {
										var sel = selected[i];
															
										for (var j = 0; j < simulatedRows.length; j++) {
											var simulatedRow = simulatedRows[j];
											if ((sel.invoiceId == simulatedRow.invoiceId) && (sel.invoiceLineItemNum == simulatedRow.invoiceLineItemNum)) {                  
			
												for (var propName in sel) {
													if (simulatedRow[propName] != undefined && simulatedRow[propName] != null) { 
													
														sel[propName] = simulatedRow[propName];
													
														var value = sel[propName];
														if(!sel.getVisualElement)
														continue;
														
														var elt = sel.getVisualElement(propName);
														
														if(elt == null)
															continue;
														
															var type = elt.classList[1];
														if(type == "decimal"){	
															value = view._proto.dollarTerms(value);
														}else if(type == "percent"){
															value = view._proto.percentTerms(value);
														}
														
														view._proto.setElementValue(view, propName, elt, value);
													}
												}

											}
										}
									}
									view._proto.populateModalAlerts(view, "success", null);
								}
							},
							error: function(e) {
								//console.log("service call failed:", e);
								view._proto.populateModalAlerts(view, "systemError", null);
								view._proto.setProgressBar(view, false);
							}
						}
						setTimeout(function(){view.context.options.simulatePriceService(serviceArgs);}, 100);    
					}
				}
				else{
					
					alert("Must select at least one row to run Simulate Price.");
					return false;
				}
				
			},
			getFailedItems: function(view, failedRows) {
				var failedRowsStr = "";
				for (var i = 0; i < failedRows.length; i++) {
					failedRowsStr += "\t" + failedRows[i] + "</br>";
				}
				return failedRowsStr;
			},
			checkForSimFailures: function(view, results, items) {
				var isSuccess = true;
				var failedRows = [];
				var failedItem = "";
				if (results && results.length > 0) {
					//console.log("check for sim failures ", JSON.stringify(results));
					for (var i = 0; i < results.length; i++) {
						if (results[i].status == "failure") {
							//console.log("failure at sim", results[i].recordKeys.items);
									isSuccess = false;
									var keys = results[i].recordKeys.items;
							for (var j = 0; j < keys.length; j++) {
								failedRows.push(keys[j]);
							}
						}
					}
						//console.log("failureArray ", failureArray);
				   if (!isSuccess) {
						var failedMessage = "The Price Simulation failed for the Invoice Line Items below.  Therefore, none of the rows were processed.  Please correct the data and try again. \n" + view._proto.getFailedItems(view, failedRows);
						//this.populateModalAlerts("failure", failedMessage);
				   }
					return isSuccess;
				}
			},
			determineSubmissionType: function(view) {
				//var isPartialSubmitData = view.context.options.get("isPartialSubmit");
				var isPartialSubmit = false;
				var diff = 0;
				var filteredSelectedRecords = view.ui.get("Table").getSelectedRecords(true); //mix-match work-around to counter 'myList.get("listAllSelectedIndices")' not taking into account filtered table results
				var listValues = view.ui.get("Table").getRecords();
				var selectedListIndices = view.ui.get("Table").getSelectedIndices() 
				var allSelectedListValues = [];
				var qualifiedListValues = [];
				var qualifiedSelectedListValues = [];
				for (var i = 0; i < listValues.length; i++) {
					if (!listValues[i].isLocked && listValues[i].rebillQty > 0) {
						qualifiedListValues.push(listValues[i]);
					}
				}
				for (var j = 0; j < selectedListIndices.length; j++) {
					for (var k = 0; k < filteredSelectedRecords.length; k++) {
						if (filteredSelectedRecords[k].invoiceId == listValues[selectedListIndices[j]].invoiceId && filteredSelectedRecords[k].invoiceLineItemNum == listValues[selectedListIndices[j]].invoiceLineItemNum) {
							allSelectedListValues.push(listValues[selectedListIndices[j]]);
						}
						if (filteredSelectedRecords[k].invoiceId == listValues[selectedListIndices[j]].invoiceId && filteredSelectedRecords[k].invoiceLineItemNum == listValues[selectedListIndices[j]].invoiceLineItemNum && !listValues[selectedListIndices[j]].isLocked && listValues[selectedListIndices[j]].rebillQty > 0) {
							qualifiedSelectedListValues.push(listValues[selectedListIndices[j]]);
						}
					}
				}
				
				if (selectedListIndices.length == 0) {
					view._proto.populateModalAlerts(view, "submitNoRows");
					return false;
				}
				if (qualifiedSelectedListValues.length == 0) {
					view._proto.populateModalAlerts(view, "unqualifiedSubmit");
					return false;
				}
				if (qualifiedListValues.length > 0 && qualifiedListValues.length > qualifiedSelectedListValues.length) {
					isPartialSubmit = true;
					var crTot = 0;
					var rbTot = 0;
					var prCRTot = 0;
					var prRBTot = 0;
					var crDiff = 0;
					var rbDiff = 0;
					for (var i = 0; i < qualifiedListValues.length; i++) {
						crTot += qualifiedListValues[i].oldPrice * qualifiedListValues[i].rebillQty;
						rbTot += qualifiedListValues[i].newPrice * qualifiedListValues[i].rebillQty;
					}
					for (var j = 0; j < qualifiedSelectedListValues.length; j++) {
						prCRTot += qualifiedSelectedListValues[j].oldPrice * qualifiedSelectedListValues[j].rebillQty;
						prRBTot += qualifiedSelectedListValues[j].newPrice * qualifiedSelectedListValues[j].rebillQty;
					}
					crDiff = crTot - prCRTot;
					rbDiff = rbTot - prRBTot;
					view._proto.showPartialSubmissionModal(view, crTot, prCRTot, crDiff, rbTot, prRBTot, rbDiff);//, selectedTableRows);
					view.context.options.isPartialSubmit.set("value", isPartialSubmit);
					view.context.options.selectedCorrectionRows.set("value", allSelectedListValues);
					return false;
				}
				else {
					view.context.options.isPartialSubmit = isPartialSubmit;
					//isPartialSubmitDataCntrl.setData(isPartialSubmit);
					// this object is passed out from the coach, no service is invoked if not a partial submit
					view.context.options.selectedCorrectionRows.set("value", allSelectedListValues);
						return true;
				}
			},
			populateModalAlerts: function(view, type, simPriceFailedMsg) {
				var modalAlert = view.ui.get("Modal_Alert1");
				switch(type) {
					case "success":
					modalAlert.setColorStyle("S");
					modalAlert.setTitle("Price Simulation Success!");
					modalAlert.setText("The Price Simulation was completed successfully.");
					modalAlert.setVisible(true);
					break;
					case "overPriceSimulation":
					modalAlert.setColorStyle("G");
					modalAlert.setTitle("Attempt to Simulate Too Many Rows");
					modalAlert.setText("Please execute your Price Simulation on " + simPriceFailedMsg + " rows or less.");
					modalAlert.setVisible(true);
					break;
					case "systemError":
					modalAlert.setColorStyle("G");		
					modalAlert.setTitle("System Service Error");
					modalAlert.setText("The Price Simulation was unsuccessful due to a service failure, your systems administrator has been notified.");
					modalAlert.setVisible(true);
					break;
					case "failure":
					modalAlert.setColorStyle("G");		
					modalAlert.setTitle("Price Simulation Failure");
					modalAlert.setText(simPriceFailedMsg);
					modalAlert.setVisible(true);
					break;
					case "submitNoRows":
					modalAlert.setColorStyle("G");		
					modalAlert.setTitle("Unable to Submit Price Correction");
					modalAlert.setText("You must select at least 1 row before submitting.");
					modalAlert.setVisible(true);
					break;
					case "unqualifiedSubmit":
					modalAlert.setColorStyle("G");		
					modalAlert.setTitle("Unable to Submit Price Correction");
					modalAlert.setText("You must select at least 1 row that is NOT locked and has rebill quantity greater than 0 before submitting.");
					modalAlert.setVisible(true);
					break;
					case "returnRequestDenial":
					modalAlert.setColorStyle("G");		
					modalAlert.setTitle("Unable to Return Request");
					modalAlert.setText("This request cannot be returned as some of the lines have already been submitted for correction.");
					modalAlert.setVisible(true);
					break;
				}
			},
			showPartialSubmissionModal: function(view, crOA, crTot, crDiff, rbOA, rbTot, rbDiff) {
				var modalSection = view.ui.get("Modal_Partial_Submit");
				var crOverallTotalDisp = view.ui.get("Output_Text_Partial_Credit_Total_Total");
				var crTotalDisp = view.ui.get("Output_Text_Partial_Credit_Total");
				var crTotalDiffDisp = view.ui.get("Output_Text_Partial_Credit_Total_Difference");
				var rbOverallTotalDisp = view.ui.get("Output_Text_Partial_Rebill_Total_Total");
				var rbTotalDisp = view.ui.get("Output_Text_Partial_Rebill_Total");
				var rbTotalDiffDisp = view.ui.get("Output_Text_Partial_Rebill_Total_Difference");
				
				crOverallTotalDisp.setText(view._proto.dollarTerms(crOA));
				crTotalDisp.setText(view._proto.dollarTerms(crTot));
				crTotalDiffDisp.setText(view._proto.dollarTerms(crDiff));
				rbOverallTotalDisp.setText(view._proto.dollarTerms(rbOA));
				rbTotalDisp.setText(view._proto.dollarTerms(rbTot));
				rbTotalDiffDisp.setText(view._proto.dollarTerms(rbDiff));
				modalSection.setVisible(true);
			},
			closePartialSubmissionModal: function(view) {
				view.context.options.isPartialSubmit.set("value", false);
				view.ui.get("Modal_Partial_Submit").setVisible(false);
			},
			executePartialSubmission: function(view) {
				var instanceId = view.context.options.processInstanceId.get("value");
				var selectedCorrectionRows = view.ui.get("Table").getSelectedRecords(true);
				//var list = view.ui.get("Table").getRecords();
				//var indices = view.ui.get("Table").getSelectedIndices();
				var actionableCRData = [];	
				//var allCorrectionRowsWithVals = [];
				var crrbRequest = JSON.parse(JSON.stringify(view.context.options.crrbRequest.get("value")));
                var extraKeys = ["childrenCache", "_objectPath", "_systemCallbackHandle", "_watchCallbacks", "_inherited"];
                for (var i = 0; i < extraKeys.length; i++) {
					delete crrbRequest[extraKeys[i]];
				}
				//console.log("crrbRequest", crrbRequest);
                //var selectedRowsObj = JSON.parse(selectedCorrectionRows);
                for (var i = 0; i < selectedCorrectionRows.length; i++) {
                    if (!selectedCorrectionRows[i].isLocked) {
                        var obj = {
                            invoiceId : selectedCorrectionRows[i].invoiceId,
                            invoiceLineItemNum : selectedCorrectionRows[i].invoiceLineItemNum,
                            newWac : selectedCorrectionRows[i].newWac,
                            newBid : selectedCorrectionRows[i].newBid,
                            newLead : selectedCorrectionRows[i].newLead,
                            newConRef : selectedCorrectionRows[i].newConRef,
                            newContCogPer : selectedCorrectionRows[i].newContCogPer,
                            newItemVarPer : selectedCorrectionRows[i].newItemVarPer,
                            newWacCogPer : selectedCorrectionRows[i].newWacCogPer,
                            newItemMkUpPer : selectedCorrectionRows[i].newItemMkUpPer,
                            newAwp : selectedCorrectionRows[i].newAwp,
                            newNoChargeBack : selectedCorrectionRows[i].newNoChargeBack,
                            newOverridePrice : selectedCorrectionRows[i].newOverridePrice
                        }
                        actionableCRData.push(obj);
                        console.log("actionableCRData:  ", actionableCRData);
                    }
                }
				var input = {
					selectedCorrectionRows : actionableCRData,
					instanceId : instanceId,
					crrbRequest : crrbRequest
				};
				var serviceArgs = {
					params: JSON.stringify(input),
					load: function(data) {
						view._proto.setProgressBar(view, false);
						view._proto.toggleSubmittedRows(view, actionableCRData);
						view._proto.searchTable(view);
					},
					error: function(e) {
						console.log("service call failed: ", e);
						view._proto.setProgressBar(view, false);
					}
				}
				view._proto.setProgressBar(view, true);
				view.context.options.partialSubmissionService(serviceArgs);
				view.ui.get("Modal_Partial_Submit").setVisible(false);
			},
			toggleSubmittedRows: function(view, selectedCRs) {
                var allCRs = view.ui.get("Table").getRecords();
				for (var i = 0; i < allCRs.length; i++) {
					for (var j = 0; j < selectedCRs.length; j++) {
						if (allCRs[i].invoiceId == selectedCRs[j].invoiceId && allCRs[i].invoiceLineItemNum == selectedCRs[j].invoiceLineItemNum) {
							allCRs[i].isLocked = true;
							allCRs[i].isSubmitted = true;
						}
					}
				}	
			},
			createEditableDiv: function(view, record, propName, type, tableRowId){
				var div = document.createElement("div");
				div.className = "editableField";
				div.classList.add(type);
				var value = record[propName];				

				if(type == "decimal"){	
					if(!value){value = 0;};
					value = view._proto.dollarTerms(value);
				}else if(type == "percent"){
					if(!value){value = 0;};
					value = view._proto.percentTerms(value);
				}else if(!value){
					value = "&nbsp";
				}

				//console.log("PropName: ", propName, " value: ", value);

				div.__originalVal = record[propName];
				div.__propName = propName;

				this.setElementValue(view, propName, div, value);
				record.setVisualElement(view, propName, div);
				this.setupChangeHandler(view, type, record, propName, div, tableRowId);
				
				return div;
			},
			percentTerms: function(x) {
				return Number.parseFloat(x).toFixed(3) + "%";
			},

			dollarTerms: function(nStr) {
				nStr = Number.parseFloat(nStr).toFixed(2);
				nStr += '';
				var x = nStr.split('.');
				var x1 = x[0];
				var x2 = x.length > 1 ? '.' + x[1] : '';
				var rgx = /(\d+)(\d{3})/;
				while (rgx.test(x1)) {
						x1 = x1.replace(rgx, '$1' + ',' + '$2');
				}

				return "$"+ x1 + x2;
			},
			dateTerms: function (inputDate){
				var newDt = new Date(inputDate);
				newDt = new Date(newDt.getTime() + (newDt.getTimezoneOffset() * 1000)); 
				var dtStr = (newDt.getUTCMonth() + 1)+"/"+newDt.getUTCDate()+"/"+newDt.getUTCFullYear();  
				
				return dtStr;
			},
			_onTableCell: function(view, cell)
			{
				var dollarTerms = view._proto.dollarTerms;
				var percentTerms = view._proto.percentTerms;
				var dateTerm = view._proto.dateTerms;
				
				var thd = "."; // Thousand separator
				var dec = ","; // Decimal separator	
				var record = cell.row.data;
				var td = cell.td;
				var tableRowId = cell.row.data.invoiceId + cell.row.data.invoiceLineItemNum;
				td.parentNode.setAttribute('id', tableRowId);
				
				switch(cell.colIndex)
				{
					case 0:
						if(record.isLocked || record.rebillQty == 0){
							record.isLocked = true;
							td.parentNode.setAttribute('class', 'lockedRow');
							var lockBtn = document.createElement("button");
							lockBtn.disabled = true;
							lockBtn.style.backgroundColor = "red";
							var span = document.createElement("span");
							
							domClass.add(lockBtn, "btn btn-default btn-xs");
							domClass.add(span, "btn-label icon fa fa-lock");
							
							lockBtn.appendChild(span);
							td.appendChild(lockBtn);		
						}
						
						this.setupDataToVisualElements(view, record);
						break;
					case 1:
						td.innerHTML = "<div class=colgroup><span class=tooltiptext>Customer<div class=littleRight><br>Old WAC<br>Cur WAC<br>New WAC</div></span><div>" + record.customerId + "</div><div>" + record.customerName + "</div><div align=right style=color:red>" + dollarTerms(record.oldWac) + "</div><div align=right style=color:red>" + dollarTerms(record.curWac) + "</div></div>";
						cell.setSortValue(record.customerId);
						
						if(record.isLocked){
							td.innerHTML += "<div align=right>"+ dollarTerms(record.newWac) + "</div>";	
						}else{
							var div = this.createEditableDiv(view, record, "newWac", "decimal", tableRowId);
							td.appendChild(div);
							td.style.verticalAlign = "bottom"
						}
						
						// single line html creation:
						//td = view._proto.setInnerHTML(view, td, record, "customerId", "customerName", "oldWac", "curWac", "newWac", "decimal", tableRowId);
						
						break;
					case 2:
						td.innerHTML = "<div>" + record.materialId + "</div><div>" + record.materialName + "</div><div align=right style=color:red>" + dollarTerms(record.oldBid) + "</div><div align=right style=color:red>" + dollarTerms(record.curBid) + "</div>";
						cell.setSortValue(record.materialId);
						
						if(record.isLocked){
							td.innerHTML += "<div align=right>"+ dollarTerms(record.newBid) + "</div>";	
						}else{
							var div = this.createEditableDiv(view, record, "newBid", "decimal", tableRowId);
							td.appendChild(div);
							td.style.verticalAlign = "bottom"
						}
						//td = view._proto.setInnerHTML(view, td, record, "materialName", "h2", "oldBid", "curBid", "newBid", "decimal", tableRowId);
						break;
					case 3:
						
						td.innerHTML = "<div>" + dateTerm(record.pricingDate) + "</div><div align=right style=color:red>" + record.oldLead + "</div><div align=right style=color:red>" + record.curLead + "</div>";
						cell.setSortValue(record.pricingDate);
						
						if(record.isLocked){
							td.innerHTML += "<div align=right>"+ record.newLead + "</div>";	
						}else{
							var div = this.createEditableDiv(view, record, "newLead", "int", tableRowId);
							td.appendChild(div);
							td.style.verticalAlign = "bottom"
						}
						//td = view._proto.setInnerHTML(view, td, record, "pricingDate", "h2", "oldBid", "curBid", "newBid", "decimal", tableRowId);
						break;
					case 4:
						td.innerHTML = "<div>" + record.invoiceId +"/"+ "</div><div>" + record.invoiceLineItemNum + "</div><div align=right style=color:red>" + dollarTerms(record.oldPrice) + "</div><div align=right style=color:red>" + dollarTerms(record.curPrice) + "</div><div align=right>" + dollarTerms(record.newPrice) + "</div>";
						cell.setSortValue(record.invoiceId);
						td.style.verticalAlign = "bottom"
						break;
					case 5:
						td.innerHTML = "<div>" + record.supplierId + "</div><div>" + record.supplierName + "</div><div align=right style=color:red>" + record.oldConRef + "</div><div align=right style=color:red>" + record.curConRef + "</div>";
						cell.setSortValue(record.supplierId);
						
						if(record.isLocked){
							td.innerHTML += "<div align=right>"+ record.newConRef + "</div>";	
						}else{
							var div = this.createEditableDiv(view, record, "newConRef", "int", tableRowId);
							td.appendChild(div);
							td.style.verticalAlign = "bottom"
						}
						break;
					case 6:
						td.innerHTML = "<div>" + record.billQty + "+ (" + record.retQty + "+" + record.crQty + ")" + "</div><div align=right style=color:red>" + record.oldCbRef + "</div><div align=right style=color:red>" + record.curCbRef + "</div><div align=right>" + record.newCbRef + "</div>";
						cell.setSortValue(record.billQty);
						td.style.verticalAlign = "bottom"
						break;
					case 7:
						td.innerHTML = "<div>" + record.rebillQty + "</div><div align=right style=color:red>" + percentTerms(record.oldContCogPer) + "</div><div align=right style=color:red>" + percentTerms(record.curContCogPer) + "</div>";
						cell.setSortValue(record.rebillQty);
						
						if(record.isLocked){
							td.innerHTML += "<div align=right>"+ percentTerms(record.newContCogPer) + "</div>";	
						}else{
							var div = this.createEditableDiv(view, record, "newContCogPer", "percent", tableRowId);
							td.appendChild(div);
							td.style.verticalAlign = "bottom"
						}
						break;
					case 8:
						td.innerHTML = "<div>" + record.uom + "</div><div align=right style=color:red>" + percentTerms(record.oldItemVarPer) + "</div><div align=right style=color:red>" + percentTerms(record.curItemVarPer) + "</div>";
						cell.setSortValue(record.uom);
						
						if(record.isLocked){
							td.innerHTML += "<div align=right>"+ percentTerms(record.newItemVarPer) + "</div>";	
						}else{
							var div = this.createEditableDiv(view, record, "newItemVarPer", "percent", tableRowId);
							td.appendChild(div);
							td.style.verticalAlign = "bottom"
						}
						break;
					case 9:
						td.innerHTML = "<div>" + dateTerm(record.createdOn) + "</div><div align=right style=color:red>" + percentTerms(record.oldWacCogPer) + "</div><div align=right style=color:red>" + percentTerms(record.curWacCogPer) + "</div>";
						cell.setSortValue(record.createdOn);
						
						if(record.isLocked){
							td.innerHTML += "<div align=right>"+ percentTerms(record.newWacCogPer) + "</div>";	
						}else{
							var div = this.createEditableDiv(view, record, "newWacCogPer", "percent", tableRowId);
							td.appendChild(div);
							td.style.verticalAlign = "bottom"
						}
						break;
					case 10:
						td.innerHTML = "<div>" + record.dc + "</div><div align=right style=color:red>" + percentTerms(record.oldItemMkUpPer) + "</div><div align=right style=color:red>" + percentTerms(record.curItemMkUpPer) + "</div>";
						cell.setSortValue(record.dc);
						
						if(record.isLocked){
							td.innerHTML += "<div align=right>"+ percentTerms(record.newItemMkUpPer) + "</div>";	
						}else{
							var div = this.createEditableDiv(view, record, "newItemMkUpPer", "percent", tableRowId);
							td.appendChild(div);
							td.style.verticalAlign = "bottom"
						}
						break;
					case 11:
						td.innerHTML = "<div>" + record.poNumber + "</div><div align=right style=color:red>" + dollarTerms(record.oldAwp) + "</div><div align=right style=color:red>" + dollarTerms(record.curAwp) + "</div>";
						cell.setSortValue(record.poNumber);
						
						if(record.isLocked){
							td.innerHTML += "<div align=right>"+ dollarTerms(record.newAwp) + "</div>";	
						}else{
							var div = this.createEditableDiv(view, record, "newAwp", "decimal", tableRowId);
							td.appendChild(div);
							td.style.verticalAlign = "bottom"
						}
						break;
					case 12:
						td.innerHTML = "<div>" + record.ndcUpc + "</div><div align=right style=color:red>" + record.oldSellCd + "</div><div align=right style=color:red>" + record.curSellCd + "</div><div align=right>" + record.newSellCd + "</div>";
						cell.setSortValue(record.ndcUpc);
						td.style.verticalAlign = "bottom"
						break;
					case 13:
						td.innerHTML = "<div>" + record.billType + "</div><div align=right style=color:red>" + "&nbsp" + "</div><div align=right style=color:red>" + record.curNoChargeBack + "</div>";
						cell.setSortValue(record.billType);
						
						if(record.isLocked){
							td.innerHTML += "<div align=right>"+ record.newNoChargeBack + "</div>";	
						}else{
							var div = this.createEditableDiv(view, record, "newNoChargeBack", "int", tableRowId);
							td.appendChild(div);
							td.style.verticalAlign = "bottom"
						}
						break;
					case 14:
						td.innerHTML = "<div>" + record.chainId + "</div><div>" + record.chainName + "</div><div align=right style=color:red>" + record.oldActivePrice + "</div><div align=right style=color:red>" + record.curActivePrice + "</div><div align=right>" + record.newActivePrice + "</div>";
						cell.setSortValue(record.chainId);
						td.style.verticalAlign = "bottom"
						break;
					case 15:
						td.innerHTML = "<div>" + record.groupId + "</div><div>" + record.groupName + "/" + "</div><div>" + record.subgroupId + "</div><div>" + record.subgroupName + "</div><div align=right style=color:red>" + dollarTerms(record.oldChargeBack) + "</div><div align=right style=color:red>" + dollarTerms(record.curChargeBack) + "</div><div align=right>" + dollarTerms(record.newChargeBack) + "</div>";
						cell.setSortValue(record.groupId);
						td.style.verticalAlign = "bottom"
						break;
					case 16:
						td.innerHTML = "<div>" + record.origInvoiceId + "</div><div>" +"/"+ record.origInvoiceLineItemNum + "</div><div align=right style=color:red>" + record.oldSsf + "</div><div align=right style=color:red>" + record.curSsf + "</div><div align=right>" + record.newSsf + "</div>";
						cell.setSortValue(record.origInvoiceId);
						td.style.verticalAlign = "bottom"
						break;
					case 17:
						td.innerHTML = "<div>" + record.orgDbtMemoId + "</div><div align=right style=color:red>" + record.oldSf + "</div><div align=right style=color:red>" + record.curSf + "</div><div align=right>" + record.newSf + "</div>";
						cell.setSortValue(record.orgDbtMemoId);
						td.style.verticalAlign = "bottom"
						break;
					case 18:
						td.innerHTML = "<div>" + record.orgVendorAccAmt + "</div><div align=right style=color:red>" + dollarTerms(record.oldListPrice) + "</div><div align=right style=color:red>" + dollarTerms(record.curListPrice) + "</div><div align=right>" + dollarTerms(record.newListPrice) + "</div>";
						cell.setSortValue(record.orgVendorAccAmt);
						td.style.verticalAlign = "bottom"
						break;
					case 19:
						td.innerHTML = "<div align=right style=color:red>" + dollarTerms(record.oldOverridePrice) + "</div><div align=right style=color:red>" + dollarTerms(record.curOverridePrice) + "</div>";
						cell.setSortValue(record.oldOverridePrice);
						
						if(record.isLocked){
							td.innerHTML += "<div align=right>"+ dollarTerms(record.newOverridePrice) + "</div>";	
						}else{
							var div = this.createEditableDiv(view, record, "newOverridePrice", "decimal", tableRowId);
							td.appendChild(div);
							td.style.verticalAlign = "bottom"
						}
						break;
					default:
						return "H";
				}
				//cell.row.data
				//return null;
			},
			setInnerHTML: function(view, td, record, h1, h2, v1, v2, v3, type, tableRowId){
				var fnFormat;
				if(type == "decimal"){
					fnFormat = view._proto.dollarTerms;
				}else if(type == "percent"){
					fnFormat = view._proto.percentTerms;
				}
				td.innerHTML = "<div class=colgroup><span class=tooltiptext>Customer<div class=littleRight><br>Old WAC<br>Cur WAC<br>New WAC</div></span><div>" + record[h1] + "</div>"
				
				if(h2 != "h2"){
					td.innerHTML += "<div>" + record[h2] + "</div>"
				}

				td.innerHTML += "<div align=right style=color:red>" + (fnFormat ? fnFormat(record[v1]) : record[v1]) + "</div><div align=right style=color:red>" + (fnFormat ? fnFormat(record[v2]) : record[v2]) + "</div></div>";
				
				//cell.setSortValue(record.h1);
				if(record.isLocked){
					td.innerHTML += "<div align=right>"+ fnFormat(record[v3]) + "</div>";	
				}else{
					var div = this.createEditableDiv(view, record, v3, type, tableRowId);
					td.appendChild(div);
					td.style.verticalAlign = "bottom"
				}
				return td;
			},
			setProgressBar: function(view, status){
				view.ui.get("ProgressModal").setVisible(status);
				view.ui.get("Progress").setVisible(status);
			}
        }
    }
	/*
		Method to get a value from a record by record id and (optionally) by property name.
		If no property name is specified, the entire record is returned
	*/
	this.constructor.prototype.getDataFor = function (id, propName)
	{
		var record = this._proto.getMappedRecord(this, id);
		
		return propName != null ? record[propName] : record;
	}
	
	/*
		Method to set a value in a record by record id and property name
	*/
	this.constructor.prototype.setDataFor = function (id, propName, value)
	{
		var record = this._proto.getMappedRecord(this, id);
		
		//Update record data
		this._proto.setRecordPropValue(this, record, propName, value);
		
		//Update visual representation of the record property if it is displayed in a table row
		if(record.getVisualElement)
		{
			var elt = record.getVisualElement(propName);
			
			this._proto.setElementValue(this, propName, elt, value);
		}
	}   
	
	this.constructor.prototype.getType = function ()
	{
		return "correctionTableCV";
	}

    this.constructor.prototype.load = function ()
    {
		bpmext.ui.loadView(this);
		
		//Caching references to often-used CV children to avoid recurring lookup overhead
		this._instance.table = this.ui.get("Table");
		this._instance.progressCtl = this.ui.get("Progress");
		this._instance.progressBadgeCtl = this.ui.get("ProgressBadge");
		
		//Workaround for table performance & selection detection issue
		var view = this;
		
		this._proto.fixTable(this, this._instance.table, function(){
			view._proto.calculateSelectedTotals(view);
		});
		
		this._proto.setProgress(this, 0);
		this._proto.getCorrectionRows(this);
    }
    
    this.constructor.prototype.view = function ()
    {
    }
    
    this.constructor.prototype.change = function (event)
    {
		if(event.type == "config")
		{
			switch (event.property)
			{
				case "_metadata.visibility":
				{
					break;
				}
			}
		}
    }
    
    this.constructor.prototype.unload = function ()
    {
		bpmext.ui.loadView(this);
    }
}
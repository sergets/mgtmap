(function() {
	var ELEMENT_NODE = 1,
    	TEXT_NODE = 3;

    function onChange(div, replacements) {
		var text = div.textContent,
		    selection = window.getSelection(),
	        range,
	        doRestoreSelection = true,
	        selectionLength,
	        selectionStart;


        if(!selection.containsNode(div, true)) {
	        doRestoreSelection = false;
		} else {
			range = new Range();
		    range.setStart(div, 0);
		    range.setEnd(selection.anchorNode, selection.anchorOffset);
		    selectionLength = selection.toString().length;
		    selectionStart = range.toString().length;
		}
	        
        Object.keys(replacements).forEach(function(regex) {
        	text = text.replace(new RegExp(regex, 'g'), replacements[regex].call?
        	    replacements[regex] : 
        	    function(res) {
        	    	return '<span class="' + replacements[regex] + '">' + res + '</span>';
        	    });
        })

	    div.innerHTML = text;

	    if(doRestoreSelection) {
		    var	selectionStartPoint = getPointAtTextOffset(div, selectionStart),
		        selectionEndPoint = getPointAtTextOffset(div, selectionStart + selectionLength);
		        
		    range.setStart(selectionStartPoint.node, selectionStartPoint.offset);
		    range.setEnd(selectionEndPoint.node, selectionEndPoint.offset);
		    
		    selection.removeAllRanges();
		    selection.addRange(range);
		}
	}

	function nextTextNode(node) {
		var n = node;
		while(!n.nextSibling) {
			n = n.parentElement;
		}
		return firstTextNode(n.nextSibling);
	} 

	function firstTextNode(node) {
		if(node.nodeType == TEXT_NODE) return node;

		for(var i = 0; i < node.childNodes.length; i++) {
			var tn = firstTextNode(node.childNodes[i]);
			if(tn) return tn;
		}
	}

	function getPointAtTextOffset(node, offset) {
	    var textNode = firstTextNode(node);
	    if(!textNode) return { node : node, offset : 0 };
	    
	    var res = textNode.textContent.length;

		while(res < offset) {
	  	    textNode = nextTextNode(textNode);
	        res += textNode.textContent.length;
		}

		return {
			node : textNode,
			offset : textNode.textContent.length + offset - res
		};
	}

	simpleHighlight = function(div, replacements) {
		onChange(div, replacements);
		['blur', 'keyup', 'paste', 'input', 'click'].forEach(function(event) { 
			div.addEventListener(event, onChange.bind(null, div, replacements));
		});
	};
})();
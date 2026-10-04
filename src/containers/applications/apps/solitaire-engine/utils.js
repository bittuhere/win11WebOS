// conveneince function for checking those pesky sub-elements that get clicked on all the time
export function selfOrParentCheck(event, parentSelector) {
    return event.target.matches(`${parentSelector}, ${parentSelector} *`);
}
// convenience function for getting an element's order amongst its siblings
export function getChildIdx(parentElement, childElement) {
    return Array.from(parentElement.children).indexOf(childElement);
}
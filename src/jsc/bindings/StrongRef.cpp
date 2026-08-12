#include "root.h"
#include "StrongRef.h"
#include <JavaScriptCore/StrongSet.h>

extern "C" JSC::JSValue* Bun__StrongRef__new(JSC::JSGlobalObject* globalObject, JSC::EncodedJSValue encodedValue)
{
    JSC::HandleSlot slot = JSC::getVM(globalObject).heap.strongSet()->allocate();
    // Plain store, like JSC::Strong::set(): the "Sh" marking constraint scans
    // every StrongSet slot, so there is no barrier to run.
    *slot = JSC::JSValue::decode(encodedValue);
    return slot;
}

extern "C" void Bun__StrongRef__delete(JSC::JSValue* _Nonnull slot)
{
    JSC::StrongSet::deallocate(slot);
}

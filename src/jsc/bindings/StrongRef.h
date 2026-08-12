#pragma once
#include <JavaScriptCore/JSCJSValue.h>
#include <memory>

// One slot in the VM's JSC::StrongSet, the storage JSC::Strong<> itself uses.
// The slot pointer is the handle: bun_jsc::Strong (Strong.rs) reads and writes
// the JSValue through it directly and only comes back here to release it.
extern "C" void Bun__StrongRef__delete(JSC::JSValue* _Nonnull slot);
extern "C" JSC::JSValue* Bun__StrongRef__new(JSC::JSGlobalObject* globalObject, JSC::EncodedJSValue encodedValue);

namespace Bun {

struct StrongRefDeleter {
    void operator()(JSC::JSValue* _Nonnull slot)
    {
        Bun__StrongRef__delete(slot);
    }
};

using StrongRef = std::unique_ptr<JSC::JSValue, StrongRefDeleter>;

}

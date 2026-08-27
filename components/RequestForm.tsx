import { CheckCircle2 } from "lucide-react";
import { submitMirrorRequest } from "@/app/actions";
import { SubmitRequestButton } from "@/components/SubmitRequestButton";

const years = Array.from({ length: 31 }, (_, index) => String(new Date().getFullYear() + 1 - index));
const makes = ["Toyota", "Honda", "Ford", "Chevrolet", "Nissan", "Hyundai", "Kia", "Subaru", "BMW", "Mercedes-Benz", "Audi", "Lexus", "Other"];
const features = ["Power adjust", "Heated glass", "Blind spot alert", "Turn signal", "Puddle light", "Memory", "Power fold", "Camera"];
const colors = ["Black", "White", "Silver", "Gray", "Blue", "Red", "Unpainted", "Other"];

export function RequestForm({ submitted }: { submitted: boolean }) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-brand">Exact-fit sourcing</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">Get your replacement mirror quote</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-muted">
          Send the vehicle details and contact info. The admin team can research, match, quote, and order from one dashboard.
        </p>
      </div>

      {submitted ? (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Request received! We&apos;re finding your exact part and will reach out with a quote as soon as possible.</p>
          </div>
        </div>
      ) : null}

      <form action={submitMirrorRequest} className="space-y-8 rounded-lg border border-line bg-panel p-4 shadow-soft sm:p-6">
        <section className="space-y-4">
          <h2 className="section-title">Vehicle Identification</h2>
          <label className="space-y-2">
            <span className="field-label">Vehicle Identification Number (VIN)</span>
            <input
              name="vin"
              className="field-input h-12 text-base uppercase tracking-wider"
              placeholder="17-character VIN"
              minLength={11}
              maxLength={17}
            />
          </label>
          <p className="text-sm leading-6 text-muted">
            Entering your VIN gives us the most accurate match for trim, wiring, glass, paint, and mirror features.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="section-title">Mirror Details</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="space-y-2">
              <span className="field-label">Side</span>
              <select name="side" required className="field-input">
                <option value="">Select side</option>
                <option>Driver</option>
                <option>Passenger</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="field-label">Color</span>
              <select name="color" required className="field-input">
                <option value="">Select color</option>
                {colors.map((color) => <option key={color}>{color}</option>)}
              </select>
            </label>
          </div>
        </section>

        <details className="rounded-md border border-line bg-field p-4">
          <summary className="cursor-pointer text-sm font-bold text-brand">Don&apos;t have your VIN? Enter details manually</summary>
          <section className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="field-label">Year</span>
                <select name="year" className="field-input bg-white">
                  <option value="">Select year</option>
                  {years.map((year) => <option key={year}>{year}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <span className="field-label">Make</span>
                <select name="make" className="field-input bg-white">
                  <option value="">Select make</option>
                  {makes.map((make) => <option key={make}>{make}</option>)}
                </select>
              </label>
              <label className="space-y-2">
                <span className="field-label">Model</span>
                <input name="model" className="field-input bg-white" placeholder="Camry, F-150, CR-V" />
              </label>
              <label className="space-y-2">
                <span className="field-label">Trim</span>
                <input name="trim" className="field-input bg-white" placeholder="EX-L, XLE, Limited" />
              </label>
            </div>
            <fieldset className="space-y-3">
              <legend className="field-label">Features</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {features.map((feature) => (
                  <label key={feature} className="flex min-h-11 items-center gap-3 rounded-md border border-line bg-white px-3 text-sm font-medium text-ink">
                    <input name="features" value={feature} type="checkbox" className="size-4 accent-brand" />
                    {feature}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
        </details>

        <section className="space-y-4">
          <h2 className="section-title">Customer Contact</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="space-y-2">
              <span className="field-label">Name</span>
              <input name="customer_name" required className="field-input" placeholder="Customer name" />
            </label>
            <label className="space-y-2">
              <span className="field-label">Phone</span>
              <input name="customer_phone" required className="field-input" type="tel" placeholder="(555) 123-4567" />
            </label>
            <label className="space-y-2">
              <span className="field-label">Email (optional)</span>
              <input name="customer_email" className="field-input" type="email" placeholder="name@example.com" />
            </label>
          </div>
        </section>

        <SubmitRequestButton />
      </form>
    </div>
  );
}

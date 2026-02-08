import { MessageSquare, ClipboardList, Users, CheckCircle } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: MessageSquare,
    title: "Get alerted instantly",
    description: "New violations trigger immediate SMS notifications with all the details you need to act.",
    sms: {
      type: "incoming",
      message: "⚠️ New FDNY violation at 123 Main St. Due Oct 12. Reply \"summary\" or \"status\".",
    },
  },
  {
    number: "02",
    icon: ClipboardList,
    title: "Work order auto-created",
    description: "A work order is automatically generated and linked to the violation for tracking.",
    sms: {
      type: "system",
      message: "Work Order #1234 created: Resolve FDNY Violation #ECB-123456",
    },
  },
  {
    number: "03",
    icon: Users,
    title: "Coordinate via SMS",
    description: "Text your vendors directly. All messages are saved to the property record automatically.",
    sms: {
      type: "outgoing",
      message: "Hi Mike, we have a sprinkler inspection needed at 123 Main. Available this week?",
    },
  },
  {
    number: "04",
    icon: CheckCircle,
    title: "Track to completion",
    description: "Monitor progress, collect documentation, and close out violations with full audit trails.",
    sms: {
      type: "success",
      message: "✅ Violation resolved. Certificate uploaded. Work order #1234 closed.",
    },
  },
];

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="py-24 bg-secondary/30">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-card text-foreground text-sm font-medium mb-4 border border-border">
            <span className="w-2 h-2 rounded-full bg-success" />
            Simple Workflow
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            From violation to resolution
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            See how Threshold automates your compliance workflow with SMS-first communication.
          </p>
        </div>

        {/* Steps */}
        <div className="max-w-4xl mx-auto">
          {steps.map((step, index) => (
            <div 
              key={index}
              className="relative flex gap-6 pb-12 last:pb-0"
            >
              {/* Timeline line */}
              {index < steps.length - 1 && (
                <div className="absolute left-6 top-12 w-px h-[calc(100%-3rem)] bg-border" />
              )}

              {/* Step number */}
              <div className="relative z-10 w-12 h-12 rounded-full bg-primary flex items-center justify-center shrink-0">
                <span className="text-sm font-bold text-primary-foreground">{step.number}</span>
              </div>

              {/* Content */}
              <div className="flex-1 pt-1">
                <div className="flex items-center gap-3 mb-2">
                  <step.icon className="w-5 h-5 text-accent" />
                  <h3 className="font-display text-xl font-semibold text-foreground">
                    {step.title}
                  </h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  {step.description}
                </p>

                {/* SMS Preview */}
                <div className={`
                  inline-block max-w-md p-3 rounded-2xl text-sm
                  ${step.sms.type === 'incoming' ? 'bg-card border border-border rounded-tl-none' : ''}
                  ${step.sms.type === 'outgoing' ? 'bg-primary text-primary-foreground rounded-tr-none ml-auto' : ''}
                  ${step.sms.type === 'system' ? 'bg-secondary text-secondary-foreground border border-border' : ''}
                  ${step.sms.type === 'success' ? 'bg-success/10 text-success border border-success/20' : ''}
                `}>
                  {step.sms.message}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;

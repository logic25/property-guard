import { 
  Bell, 
  MessageSquare, 
  FileCheck, 
  BookOpen,
  Zap,
  Building2,
  ArrowRight
} from "lucide-react";

const features = [
  {
    icon: Bell,
    title: "Violation Monitoring",
    description: "Automatic alerts for new NYC violations from DOB, ECB, and FDNY. Get notified instantly when issues arise.",
    color: "destructive",
    highlight: "NYC-First",
  },
  {
    icon: MessageSquare,
    title: "SMS Work Threads",
    description: "Manage all vendor communication via text. Every message is automatically saved to the property record.",
    color: "success",
    highlight: "Primary Interface",
  },
  {
    icon: FileCheck,
    title: "COI Tracking",
    description: "Never miss an expiring certificate. Automatic reminders ensure vendors stay compliant.",
    color: "warning",
    highlight: "Auto-Reminders",
  },
  {
    icon: BookOpen,
    title: "Lease Q&A",
    description: "Ask questions about your leases in plain English. Get cited answers with exact page references.",
    color: "accent",
    highlight: "AI-Powered",
  },
];

const Features = () => {
  return (
    <section id="features" className="py-24 bg-background">
      <div className="container mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-4">
            <Zap className="w-4 h-4" />
            Core Features
          </div>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Everything you need to stay compliant
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Purpose-built for NYC property owners. Simple enough to use via text, powerful enough to replace your spreadsheets.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {features.map((feature, index) => (
            <div
              key={index}
              className="group relative p-6 rounded-xl border border-border bg-card hover:shadow-card-hover transition-all duration-300"
            >
              {/* Highlight badge */}
              <div className="absolute top-4 right-4">
                <span className="px-2 py-1 rounded text-xs font-medium bg-secondary text-muted-foreground">
                  {feature.highlight}
                </span>
              </div>

              {/* Icon */}
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-${feature.color}/10`}>
                <feature.icon className={`w-6 h-6 text-${feature.color}`} />
              </div>

              {/* Content */}
              <h3 className="font-display text-xl font-semibold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>

              {/* Hover arrow */}
              <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Learn more
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-4 p-4 rounded-xl border border-border bg-card">
            <Building2 className="w-8 h-8 text-primary" />
            <div className="text-left">
              <p className="font-medium text-foreground">Non-NYC properties?</p>
              <p className="text-sm text-muted-foreground">Basic vendor & work order management still available.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Features;

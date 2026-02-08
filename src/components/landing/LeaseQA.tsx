import { BookOpen, MessageCircle, Quote } from "lucide-react";

const LeaseQA = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Content */}
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-sm font-medium mb-4">
                <BookOpen className="w-4 h-4" />
                Lease Q&A
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
                Ask your lease anything
              </h2>
              <p className="text-lg text-muted-foreground mb-6">
                Upload your lease documents and ask questions in plain English. Get answers with exact citations—no legal advice, just the facts.
              </p>

              <div className="space-y-4">
                {[
                  "Who's responsible for sprinkler inspections?",
                  "What's the rent escalation clause?",
                  "Can the tenant sublease?",
                ].map((question, i) => (
                  <div key={i} className="flex items-center gap-3 text-muted-foreground">
                    <MessageCircle className="w-5 h-5 text-accent shrink-0" />
                    <span className="text-sm">{question}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat Demo */}
            <div className="relative">
              <div className="absolute inset-0 bg-accent/5 rounded-2xl blur-xl" />
              <div className="relative bg-card rounded-xl border border-border shadow-card overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-border bg-secondary/50">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium text-foreground">Lease Assistant</span>
                  </div>
                </div>

                {/* Messages */}
                <div className="p-4 space-y-4">
                  {/* User message */}
                  <div className="flex justify-end">
                    <div className="max-w-[80%] px-4 py-2 rounded-2xl rounded-tr-none bg-primary text-primary-foreground text-sm">
                      Who's responsible for the sprinkler system?
                    </div>
                  </div>

                  {/* AI response */}
                  <div className="flex justify-start">
                    <div className="max-w-[90%] space-y-3">
                      <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-secondary text-secondary-foreground text-sm">
                        <p className="mb-3">
                          The lease places <strong>sprinkler inspection responsibility on the tenant</strong> for all systems within the demised premises.
                        </p>
                        
                        <div className="flex items-start gap-2 p-2 rounded-lg bg-card border border-border">
                          <Quote className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <p className="text-muted-foreground mb-1">Section 7.2, Page 14</p>
                            <p className="italic">"Tenant shall maintain and inspect all fire suppression equipment..."</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning">
                        ⚠️ No amendments found that modify this clause.
                      </div>
                    </div>
                  </div>
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-border">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary">
                    <MessageCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Ask a question about your lease...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LeaseQA;

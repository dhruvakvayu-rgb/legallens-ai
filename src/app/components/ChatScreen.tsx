import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Header } from './Header';
import { LogoIcon } from './Logo';
import { ComplexitySlider } from './ComplexitySlider';
import { useDocument } from '../lib/documentStore';
import { getTier } from '../lib/complexityContent';
import { Send, FileSearch } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

function generateResponse(
  question: string,
  complexityLevel: number,
  chatContext: string,
  rawText: string,
): string {
  const q = question.toLowerCase();
  const tier = getTier(complexityLevel);
  const doc = rawText.toLowerCase();

  if (/sign|should i|recommend|safe|proceed/i.test(q)) {
    const hasHighRisk = /terminat|perpetuity|penalt|forfeit/i.test(doc);
    const hasSeverance = /severance|separation pay/i.test(doc);
    const hasNonCompete = /non.compet|not.*compet/i.test(doc);
    if (!hasHighRisk) return 'This document looks relatively straightforward, but it is always worth having someone review it before you sign.';
    const verdicts: Record<typeof tier, string> = {
      eli5: 'I would talk to a grown-up you trust first. There are some tricky parts in this document that might not be great for you.',
      simple: `I would be careful before signing. ${hasNonCompete ? 'There is a non-compete clause that limits your options. ' : ''}${!hasSeverance ? 'There is no severance if you are let go. ' : ''}It is worth having a lawyer look it over.`,
      balanced: `I recommend reviewing this carefully before signing. ${hasNonCompete ? 'The non-compete clause could limit your career options. ' : ''}${!hasSeverance ? 'There is no severance provision, which creates financial risk. ' : ''}Consider consulting an employment attorney.`,
      detailed: `I advise against signing without negotiation. Key concerns: ${!hasSeverance ? '(1) no severance provision creates financial exposure upon termination; ' : ''}${hasNonCompete ? '(2) non-compete clause lacks geographic specificity; ' : ''}(3) some terms are insufficiently defined. Request amendments and seek independent legal counsel.`,
      expert: `Based on analysis of this instrument, I strongly advise against immediate execution. ${!hasSeverance ? 'The absence of severance provisions creates acute financial exposure. ' : ''}${hasNonCompete ? 'The non-compete covenant lacks the geographic and temporal specificity required for enforceability under the reasonableness standard. ' : ''}Recommend formal legal consultation and targeted renegotiation prior to execution.`,
    };
    return verdicts[tier];
  }

  if (/summar|what is|overview|explain.*document|about this/i.test(q)) {
    const verdicts: Record<typeof tier, string> = {
      eli5: `This is a legal paper. It says what you and the other person have to do. ${chatContext}`,
      simple: `This document sets out the terms between the parties. ${chatContext}`,
      balanced: `This is a legal agreement that establishes rights and obligations between the parties. ${chatContext}`,
      detailed: `This instrument governs the relationship between the contracting parties. ${chatContext} Review all provisions carefully before execution.`,
      expert: `This legal instrument establishes a formal contractual relationship. ${chatContext} Each provision carries distinct legal implications requiring careful consideration.`,
    };
    return verdicts[tier];
  }

  if (/terminat|fire|fired|dismiss|end.*job|quit/i.test(q)) {
    if (!/terminat/i.test(doc)) return 'The document does not appear to contain a specific termination clause. Review the full text carefully.';
    const hasSeverance = /severance/i.test(doc);
    const noticeMatch = doc.match(/(\d+)\s*days.*notice/i);
    const days = noticeMatch?.[1];
    const verdicts: Record<typeof tier, string> = {
      eli5: `This document says ${hasSeverance ? 'you get some money if you lose your job' : 'you can be told to leave without getting extra money'}. ${days ? `They have to tell you ${days} days before.` : 'They do not have to warn you first.'}`,
      simple: `The termination clause ${hasSeverance ? 'includes severance pay' : 'does not include severance'}. ${days ? `A ${days}-day notice period is required.` : 'No notice period is specified.'}`,
      balanced: `The termination provision ${hasSeverance ? 'includes a severance component' : 'lacks severance provisions'}. ${days ? `A ${days}-day notice period applies.` : 'No notice period is defined, which means termination could be immediate.'} This is an important clause to review carefully.`,
      detailed: `The termination clause establishes ${hasSeverance ? 'employment with severance provisions' : 'employment without severance'}. ${days ? `A ${days}-day notice requirement applies to both parties.` : 'The absence of a notice period creates risk of immediate termination without financial protection.'} Consider negotiating ${!hasSeverance ? 'severance terms and ' : ''}${!days ? 'a notice period' : 'clearer termination conditions'}.`,
      expert: `The termination provision ${hasSeverance ? 'incorporates severance obligations' : 'is silent on severance, creating financial exposure'}. ${days ? `The ${days}-day notice requirement provides some procedural protection.` : 'The absence of a notice period may conflict with implied covenant protections in certain jurisdictions.'} ${!hasSeverance ? 'The lack of severance provisions should be addressed through negotiation prior to execution.' : ''}`,
    };
    return verdicts[tier];
  }

  if (/non.compet|compet|rival|competitor/i.test(q)) {
    if (!/non.compet|not.*compet/i.test(doc)) return 'This document does not appear to contain a non-compete clause.';
    const isPost = /after.*employ|post.employ/i.test(doc);
    const verdicts: Record<typeof tier, string> = {
      eli5: `This document says you cannot work for companies that do the same thing${isPost ? ', even after you leave' : ' while you work here'}. It is like being on one team and not being allowed to play for another.`,
      simple: `There is a non-compete clause that prevents you from working for competitors${isPost ? ' even after leaving' : ' during employment'}. This limits your job options.`,
      balanced: `The non-compete clause restricts competitive employment${isPost ? ' both during and after the agreement' : ' during the term'}. The scope of what counts as competitive should be clearly defined to avoid disputes.`,
      detailed: `The non-compete covenant prohibits competitive employment${isPost ? ' during and following the agreement term' : ' during the employment period'}. The clause lacks geographic and industry-specific scope definitions, which creates enforceability ambiguity. Courts apply a reasonableness standard to such provisions.`,
      expert: `The restrictive covenant functions as a ${isPost ? 'post-employment' : 'concurrent'} non-compete provision. Its enforceability is jurisdiction-dependent — void ab initio in California under Bus. & Prof. Code §16600, and subject to reasonableness scrutiny elsewhere. The absence of defined geographic scope and temporal duration creates overbreadth concerns and potential blue-penciling risk.`,
    };
    return verdicts[tier];
  }

  if (/confidential|secret|nda|disclos|proprietary/i.test(q)) {
    if (!/confidential|nda|non.disclos/i.test(doc)) return 'This document does not appear to contain a confidentiality clause.';
    const isPerpetual = /perpetuity|forever|indefinite/i.test(doc);
    const verdicts: Record<typeof tier, string> = {
      eli5: `You have to keep the information in this document secret${isPerpetual ? ' forever, even after you leave' : ' while the agreement is active'}. Like a promise you cannot break.`,
      simple: `The confidentiality clause requires you to keep information private${isPerpetual ? ' indefinitely, even after the agreement ends' : ''}. This includes trade secrets and business data.`,
      balanced: `The confidentiality provision obligates you to protect all proprietary information${isPerpetual ? ' in perpetuity — with no expiration date' : ''}. This covers trade secrets, business strategies, and internal data.`,
      detailed: `The confidentiality obligation${isPerpetual ? ' is perpetual, with no defined sunset period' : ' applies during the agreement term'}. The broad scope may be challenged as overbroad in jurisdictions requiring narrowly tailored confidentiality obligations. Consider requesting a time-limited clause.`,
      expert: `The confidentiality covenant${isPerpetual ? ' imposes indefinite non-disclosure obligations, creating unconscionability risk absent reasonable scope limitations' : ' is temporally bounded'}. The provision should be assessed against the Defend Trade Secrets Act (18 U.S.C. §1836) definitions and applicable state trade secret law.`,
    };
    return verdicts[tier];
  }

  if (/pay|salary|compensat|wage|money|bonus/i.test(q)) {
    if (!/compensat|salary|wage|pay/i.test(doc)) return 'This document does not appear to specify compensation terms.';
    const isDiscretionary = /at.*discretion|as.*determin/i.test(doc);
    const verdicts: Record<typeof tier, string> = {
      eli5: `The document talks about how much money you get. ${isDiscretionary ? 'But the other party gets to decide how much — that is not great for you.' : 'Make sure you understand when and how you get paid.'}`,
      simple: `The compensation terms ${isDiscretionary ? "are at the other party's discretion, which means they can change your pay" : 'are outlined in the document'}. Make sure the payment schedule is clearly defined.`,
      balanced: `The compensation clause ${isDiscretionary ? 'grants the other party discretion over pay, which creates uncertainty' : 'defines the payment structure'}. Ensure the payment schedule, method, and any bonus conditions are clearly specified.`,
      detailed: `The compensation provision ${isDiscretionary ? 'lacks contractual precision — discretionary pay terms create dispute risk and may be challenged as illusory consideration' : 'defines the payment structure'}. Request a fixed schedule, defined payment method, and clear bonus criteria.`,
      expert: `The compensation structure ${isDiscretionary ? "may fail the definiteness requirement for contract formation if pay is entirely at the counterparty's discretion — potentially rendering the consideration illusory" : 'provides a defined payment framework'}. Ensure all contingencies, payment schedules, and bonus triggers are contractually specified to avoid future disputes.`,
    };
    return verdicts[tier];
  }

  const fallbacks: Record<typeof tier, string> = {
    eli5: `Good question! This document is about ${chatContext.split('.')[0].replace('Document: ', '')}. Ask me something more specific and I will try to explain it simply.`,
    simple: `Based on this document: ${chatContext} What specific part would you like me to explain?`,
    balanced: `This document covers several important areas. ${chatContext} Could you ask about a specific clause or topic for a more detailed answer?`,
    detailed: `The document contains multiple provisions worth examining. ${chatContext} Please specify which clause or topic you would like me to analyze in detail.`,
    expert: `This instrument presents several provisions warranting legal scrutiny. ${chatContext} Please specify the clause or legal issue you would like me to address.`,
  };
  return fallbacks[tier];
}

export function ChatScreen() {
  const navigate = useNavigate();
  const { analysis, rawText } = useDocument();
  const [complexityLevel, setComplexityLevel] = useState(5);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const welcomeMessage = analysis
    ? `Hello! I have analyzed your document: "${analysis.title}". I found ${analysis.risks.length} risk(s) with a ${analysis.riskScore}% risk score. Ask me anything about it.`
    : 'Hello! I am your AI legal assistant. Upload a document first, then ask me anything about it.';

  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', content: welcomeMessage },
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!analysis || !rawText) {
    return (
      <div className="min-h-screen bg-background transition-colors duration-300">
        <Header />
        <main className="max-w-2xl mx-auto px-6 py-32 text-center">
          <FileSearch className="w-16 h-16 text-muted-foreground mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-foreground mb-3">No document loaded</h2>
          <p className="text-muted-foreground mb-8">Upload a document first so I can answer questions about it.</p>
          <button
            onClick={() => navigate('/')}
            className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-shadow"
          >
            Go to Upload
          </button>
        </main>
      </div>
    );
  }

  const handleSend = (overrideInput?: string) => {
    const text = (overrideInput ?? input).trim();
    if (!text) return;
    setMessages((prev) => [...prev, { id: prev.length + 1, role: 'user', content: text }]);
    setInput('');
    setTimeout(() => {
      const response = generateResponse(text, complexityLevel, analysis.chatContext, rawText);
      setMessages((prev) => [...prev, { id: prev.length + 1, role: 'assistant', content: response }]);
    }, 600);
  };

  const quickPrompts = [
    'Should I sign this?',
    'Summarize the document',
    'What are the biggest risks?',
    'Explain the termination clause',
    'What are my obligations?',
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-300">
      <Header />
      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-6">
          <h2 className="text-3xl font-bold text-foreground mb-1">AI Legal Assistant</h2>
          <p className="text-muted-foreground">
            Discussing: <span className="font-medium text-foreground">{analysis.title}</span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl border border-blue-200 dark:border-blue-800 p-6 mb-6 transition-colors duration-300"
        >
          <ComplexitySlider value={complexityLevel} onChange={setComplexityLevel} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="flex-1 bg-card rounded-2xl border border-border p-6 mb-6 overflow-y-auto min-h-[300px] max-h-[480px] transition-colors duration-300 dark:shadow-[0_0_30px_rgba(59,130,246,0.05)]"
        >
          <div className="space-y-6">
            <AnimatePresence initial={false}>
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0"><LogoIcon size={40} /></div>
                  )}
                  <div className={`max-w-[75%] p-4 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                      : 'bg-muted text-foreground'
                  }`}>
                    <p className="leading-relaxed text-sm">{message.content}</p>
                  </div>
                  {message.role === 'user' && (
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-semibold text-muted-foreground">You</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}>
          <div className="flex gap-2 mb-4 flex-wrap">
            {quickPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                className="px-3 py-1.5 bg-card border border-border rounded-lg text-xs font-medium hover:bg-accent text-foreground transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="Ask about your document…"
              className="flex-1 px-6 py-4 border border-border rounded-xl bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-colors duration-200"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-shadow disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
              Send
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}

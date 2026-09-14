from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, Table, TableStyle, KeepTogether

OUT="public/legal/"
orange=colors.HexColor('#E65F35'); cream=colors.HexColor('#FFF8EF'); brown=colors.HexColor('#211A16'); muted=colors.HexColor('#6B5A4E')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleWA',parent=styles['Title'],fontName='Helvetica-Bold',fontSize=22,leading=25,textColor=brown,alignment=TA_CENTER,spaceAfter=8))
styles.add(ParagraphStyle(name='SubWA',parent=styles['Normal'],fontSize=9,leading=13,textColor=muted,alignment=TA_CENTER,spaceAfter=14))
styles.add(ParagraphStyle(name='H1WA',parent=styles['Heading1'],fontName='Helvetica-Bold',fontSize=13,leading=16,textColor=orange,spaceBefore=10,spaceAfter=5))
styles.add(ParagraphStyle(name='BodyWA',parent=styles['BodyText'],fontName='Helvetica',fontSize=9.2,leading=13.4,textColor=brown,spaceAfter=6))
styles.add(ParagraphStyle(name='BoxWA',parent=styles['BodyText'],fontName='Helvetica-Bold',fontSize=9.3,leading=13.5,textColor=brown,spaceAfter=0))
styles.add(ParagraphStyle(name='FootWA',parent=styles['Normal'],fontSize=7.5,textColor=muted,alignment=TA_CENTER))

def footer(canvas,doc):
    canvas.saveState(); canvas.setStrokeColor(colors.HexColor('#E7DDD3')); canvas.line(18*mm,15*mm,letter[0]-18*mm,15*mm)
    canvas.setFont('Helvetica',7.5); canvas.setFillColor(muted); canvas.drawString(18*mm,10*mm,'WHACKY AUCTIONS | AUCTION LEGAL')
    canvas.drawRightString(letter[0]-18*mm,10*mm,f'Page {doc.page}'); canvas.restoreState()

def box(text):
    t=Table([[Paragraph(text,styles['BoxWA'])]],colWidths=[170*mm]); t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),cream),('BOX',(0,0),(-1,-1),1,orange),('LEFTPADDING',(0,0),(-1,-1),10),('RIGHTPADDING',(0,0),(-1,-1),10),('TOPPADDING',(0,0),(-1,-1),9),('BOTTOMPADDING',(0,0),(-1,-1),9)])); return t

def heading(title,subtitle):
    return [Paragraph('WHACKY AUCTIONS',styles['TitleWA']),Paragraph(title,styles['TitleWA']),Paragraph(subtitle,styles['SubWA'])]

def section(n,title,text):
    return [Paragraph(f'{n}. {title}',styles['H1WA']),Paragraph(text,styles['BodyWA'])]

master=[]
master+=heading('APP TERMS & CONDITIONS<br/>AND MASTER RULES OF AUCTION','Version 1.1 | Effective 14 September 2026')
master+=[box('<b>IMPORTANT PAYMENT TERMS</b><br/>A once-off R10 Yoco payment is required to activate bidder verification. A winning bidder must pay the full displayed amount through the separate winning-order checkout within 2 hours, unless the auction-specific schedule lawfully states another period. The R10 verification payment does not authorise Whacky Auctions to save or automatically debit a card.') ,Spacer(1,8)]
sections=[
('Parties, scope and acceptance','These terms govern use of the Whacky Auctions website and app and participation in auctions conducted by Whacky Auctions PTY LTD. Registration, bidder verification or a bid constitutes acceptance of these terms, the applicable auction-specific schedule and the lot disclosures. Mandatory law prevails over inconsistent wording.'),
('Eligibility and bidder registration','Bidders must be 18 or older and legally capable of contracting. Internet bidders must provide the information required by applicable auction regulations, including identity, age, physical address, contact, login, IP and payment-method particulars. A bid from an unregistered or unverified person is invalid. Authority is required when bidding for another person or entity.'),
('R10 bidder-verification payment','After completing registration, the bidder must make a once-off R10 payment through the Yoco-hosted checkout before bidding privileges activate. The fee pays for payment-method and bidder-account verification and is non-refundable once verification succeeds, except where law requires otherwise. Card data is entered with and handled by Yoco; Whacky Auctions does not receive or store the full card number or CVV. This payment is not a deposit against a future purchase and does not authorise recurring or automatic charges.'),
('Auction-specific information','Each auction or lot page will display the start and closing times, online location, auctioneer, reserve status, opening bid, increments, buyer premium, VAT treatment, payment deadline, inspection, collection, storage and other applicable terms. Opening bids are not valuations.'),
('Reserve and no-reserve lots','A lot may have a reserve unless expressly advertised without reserve. A reserve lot is sold only when the reserve is met or lawfully accepted. No-reserve lots are handled in accordance with section 45 of the Consumer Protection Act and applicable regulations.'),
('Bids and bidder responsibility','A bid is an offer to buy. Bidders must review the full listing and keep credentials secure. The platform/server timestamp and audit record determine priority, subject to correction of a proven system error before completion.'),
('Rolling two-minute soft close','A valid bid in the final 2 minutes restores a full 2-minute window. Each further valid bid in the renewed final window extends the lot again. Extensions may repeat without a fixed maximum. The server clock and auction log are authoritative.'),
('Bid retraction and completion','A bid may be retracted before the sale is completed using the available facility or prompt contact. After the platform records SOLD, WON or an equivalent completed status, the highest qualifying bid is binding, subject to non-waivable legal rights.'),
('Purchase price and disclosed charges','The payable amount may include the hammer price, disclosed buyer premium, VAT and disclosed collection, delivery or storage charges. No undisclosed charge will be imposed.'),
('Winning-order payment - 2-hour deadline','The winning bidder must make full cleared payment using the Yoco checkout linked to the winning order within 2 hours after the sale completes, unless a different lawful deadline was clearly disclosed before bidding. The website displays the deadline. Returning from checkout does not prove payment; the verified payment-provider confirmation controls. Goods are not released before cleared payment.'),
('Purchaser default, relisting and default charge','A purchaser defaults by failing to pay by the displayed deadline, dishonouring or reversing payment, or failing required verification without lawful excuse. After expiry, Whacky Auctions may cancel the sale, remove bidding privileges and re-offer the lot. Any default fee or commission is limited to the <b>lesser of 10% of the purchase price or the total cost of advertising and conducting the auction plus reasonably incurred additional costs</b>, and will be reduced where the statutory cap is lower. The fee is not a substitute for other remedies lawfully available and is not charged where prohibited.'),
('Condition and inspection','A reasonable inspection opportunity will be provided as stated. Auction goods are sold in their disclosed condition, as-is/voetstoots, to the extent permitted by law. This does not exclude liability that cannot lawfully be excluded, including deliberate misrepresentation or legally actionable non-delivery.'),
('Descriptions and photographs','Reasonable care is used in descriptions and photographs. Bidders must consider the full listing. Material errors discovered before completion may be corrected and the lot paused, extended, withdrawn or re-offered where lawful.'),
('Collection, ownership and risk','Collection or delivery instructions must be followed. Ownership passes only after cleared payment and lawful release. Risk passes as required by law. Disclosed storage charges may apply after the collection deadline.'),
('Technical failures','A proven platform-wide failure may justify pausing, extending, reopening or rerunning an affected lot where lawful and recorded. A bidder device, battery or connectivity failure ordinarily does not undo a completed sale.'),
('Prohibited conduct and suspension','False identities, sham bidding, collusion, bid shielding, intimidation, automation abuse, payment fraud and unauthorised access are prohibited. Accounts may be restricted to protect auction integrity, investigate fraud, comply with law or enforce payment obligations.'),
('Records, privacy and payment security','Whacky Auctions will retain prescribed bidder and auction records for the legally required period. Personal information is handled under the POPIA Privacy Notice. Full card details remain with the payment provider; Whacky Auctions records payment status, amount, provider reference and audit events.'),
('Complaints and governing law','Complaints may be sent to rugs.san88@gmail.com. These terms are governed by South African law, including the Consumer Protection Act 68 of 2008, applicable auction regulations, ECTA and POPIA. Consumers retain access to applicable complaint, tribunal and court processes.'),
('Contact details','Whacky Auctions PTY LTD<br/>497 Ontdekkers Road, Florida Hills, Gauteng, South Africa<br/>rugs.san88@gmail.com'),
('Legal review','Prepared with reference to section 45 of the Consumer Protection Act and regulations 18-31. Independent South African legal review remains recommended before commercial launch and whenever the payment model or auctioneer arrangements change.')]
for i,(t,b) in enumerate(sections,1): master+=section(i,t,b)

doc=SimpleDocTemplate(OUT+'terms-auction-rules.pdf',pagesize=letter,rightMargin=18*mm,leftMargin=18*mm,topMargin=18*mm,bottomMargin=20*mm,title='Whacky Auctions App Terms and Master Rules of Auction v1.1',author='Whacky Auctions PTY LTD')
doc.build(master,onFirstPage=footer,onLaterPages=footer)

live=[]; live+=heading('STANDARD LIVE AUCTION RULES - 2026','Version 1.2 | Effective 1 September 2026')
live+=[box('<b>STANDARD TERMS FOR 2026 AUCTIONS</b><br/>These rules apply to Whacky Auctions online auctions from 1 September 2026 unless a lot page clearly discloses lawful auction-specific terms. Each listing supplies its own item description, condition, opening bid, reserve status and closing time.'),Spacer(1,10)]
rows=[('Rules period','1 September 2026 to 31 December 2026'),('Online place / URL','www.whackyauctions.co.za'),('Collection area','Florida, Gauteng'),('Weekend collection','Saturdays and Sundays, 07:00 to 17:30, by prior arrangement'),('Weekday collection','Before 06:30, by prior arrangement'),('Collection deadline','Within 30 calendar days after cleared payment'),('Courier','Available at the buyer\'s cost and arrangement; risk and provider choice remain with the buyer to the extent permitted by law'),('Buyer premium','5% of the winning bid (hammer price); any legally applicable tax will be disclosed'),('Payment deadline','2 hours after completion unless a different lawful period was disclosed before bidding'),('Bidder verification','Once-off R10 Yoco verification payment'),('Soft close','A bid in the final 2 minutes restores a full 2-minute bidding window')]
t=Table([[Paragraph(f'<b>{a}</b>',styles['BodyWA']),Paragraph(b,styles['BodyWA'])] for a,b in rows],colWidths=[62*mm,108*mm],repeatRows=0)
t.setStyle(TableStyle([('GRID',(0,0),(-1,-1),.5,colors.HexColor('#D8CCC1')),('BACKGROUND',(0,0),(0,-1),cream),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6)])); live += [t,Spacer(1,8)]
live+=[KeepTogether(section(1,'Bidder verification','Only registered users aged 18 or older whose once-off R10 Yoco bidder-verification payment has been confirmed may bid. The verification payment is not a deposit and does not authorise saved-card or automatic charges.'))]
live+=[KeepTogether(section(2,'Bidding and soft close','Each bid is binding when the sale is completed. A valid bid in the final 2 minutes restores a full 2-minute window; repeated late bids repeat the extension. Lawful pre-completion bid retractions will be processed and recorded.'))]
live+=[KeepTogether(section(3,'Price and payment','A 5% buyer premium is added to the winning bid. The winning bidder must pay the full displayed amount through the winning-order Yoco checkout by the deadline above. Payment is complete only when confirmed by the provider. No goods are released before cleared payment.'))]
live+=[KeepTogether(section(4,'Default','If cleared payment is not received by the deadline, Whacky Auctions may cancel the sale, restrict the bidder and re-offer the lot. Any default fee is capped at the lesser of 10% of the purchase price or the auction and additional costs recoverable under applicable auction regulations.'))]
live+=[KeepTogether(section(5,'Condition, collection and courier','The lot condition, known defects and inspection opportunity are disclosed in its listing. Paid goods must be collected in Florida, Gauteng within 30 calendar days, during the stated hours and by prior arrangement. A buyer may arrange and pay a courier. Whacky Auctions is not responsible for a buyer-appointed courier except to the extent liability cannot lawfully be excluded. Goods are sold as-is to the extent permitted by law; mandatory rights remain unaffected.'))]
live+=[KeepTogether(section(6,'Incorporated master rules','These standard live rules must be read with the Whacky Auctions App Terms & Master Rules of Auction v1.1. Auction-specific listing terms prevail only to the extent they are lawful and were properly disclosed before bidding.'))]
live+=[Spacer(1,8),box('<b>IMPORTANT</b><br/>A listing may lawfully vary these standard terms only when the change is clearly disclosed before bidding. The listing terms, these standard live rules and the Master Rules must be read together.')]
doc2=SimpleDocTemplate(OUT+'live-auction-rules-template.pdf',pagesize=letter,rightMargin=18*mm,leftMargin=18*mm,topMargin=18*mm,bottomMargin=20*mm,title='Whacky Auctions Standard Live Auction Rules 2026 v1.2',author='Whacky Auctions PTY LTD')
doc2.build(live,onFirstPage=footer,onLaterPages=footer)

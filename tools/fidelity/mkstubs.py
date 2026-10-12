import os, sys
root = sys.argv[1]
F = {}
F['javax/microedition/midlet/MIDlet.java'] = '''package javax.microedition.midlet;
public abstract class MIDlet {
  protected MIDlet() {}
  protected abstract void startApp();
  protected abstract void pauseApp();
  protected abstract void destroyApp(boolean b);
  public final void notifyDestroyed() {}
  public final void notifyPaused() {}
  public final String getAppProperty(String k) { return null; }
}'''
F['javax/microedition/lcdui/Displayable.java'] = '''package javax.microedition.lcdui;
public abstract class Displayable {
  public void addCommand(Command c) {}
  public void setCommandListener(CommandListener l) {}
  public int getWidth() { return 101; }
  public int getHeight() { return 80; }
}'''
F['javax/microedition/lcdui/Screen.java'] = '''package javax.microedition.lcdui;
public abstract class Screen extends Displayable {}'''
F['javax/microedition/lcdui/Canvas.java'] = '''package javax.microedition.lcdui;
public abstract class Canvas extends Displayable {
  protected Canvas() {}
  protected abstract void paint(Graphics g);
  protected void keyPressed(int k) {}
  protected void keyReleased(int k) {}
  protected void keyRepeated(int k) {}
  protected void hideNotify() {}
  protected void showNotify() {}
  public int getGameAction(int k) {
    switch (k) { case 50: return 1; case 52: return 2; case 54: return 5; case 56: return 6; case 53: return 8; }
    return 0;
  }
  public int getWidth() { return 101; }
  public int getHeight() { return 80; }
  public void repaint() {}
}'''
F['javax/microedition/lcdui/Graphics.java'] = '''package javax.microedition.lcdui;
public class Graphics {
  Font f = Font.getFont(0, 0, 0);
  public void drawRect(int a, int b, int c, int d) {}
  public void fillRect(int a, int b, int c, int d) {}
  public void drawString(String s, int a, int b, int c) {}
  public Font getFont() { return f; }
  public void setFont(Font x) { f = x; }
  public void setColor(int c) {}
}'''
F['javax/microedition/lcdui/Font.java'] = '''package javax.microedition.lcdui;
public class Font {
  public static Font getFont(int a, int b, int c) { return new Font(); }
  public int getHeight() { return 11; }
  public int stringWidth(String s) { return s.length() * 5; }
}'''
F['javax/microedition/lcdui/Image.java'] = '''package javax.microedition.lcdui;
public class Image {
  public int w, h;
  public static Image createImage(byte[] b, int off, int len) {
    Image i = new Image();
    i.w = ((b[off+16]&255)<<24)|((b[off+17]&255)<<16)|((b[off+18]&255)<<8)|(b[off+19]&255);
    i.h = ((b[off+20]&255)<<24)|((b[off+21]&255)<<16)|((b[off+22]&255)<<8)|(b[off+23]&255);
    return i;
  }
  public static Image createImage(String name) throws java.io.IOException {
    java.io.InputStream in = javax.microedition.io.Connector.openInputStream("resource:" + name);
    byte[] b = in.readAllBytes();
    return createImage(b, 0, b.length);
  }
  public int getWidth() { return w; }
  public int getHeight() { return h; }
}'''
F['javax/microedition/lcdui/Display.java'] = '''package javax.microedition.lcdui;
public class Display {
  static Display d = new Display();
  public static Display getDisplay(javax.microedition.midlet.MIDlet m) { return d; }
  public void setCurrent(Displayable x) {}
  public void setCurrent(Alert a, Displayable x) {}
}'''
F['javax/microedition/lcdui/Command.java'] = '''package javax.microedition.lcdui;
public class Command { public Command(String s, int a, int b) {} }'''
F['javax/microedition/lcdui/CommandListener.java'] = '''package javax.microedition.lcdui;
public interface CommandListener { void commandAction(Command c, Displayable d); }'''
F['javax/microedition/lcdui/List.java'] = '''package javax.microedition.lcdui;
public class List extends Screen {
  boolean[] flags = new boolean[8];
  public List(String t, int type, String[] items, Image[] imgs) {}
  public void setSelectedFlags(boolean[] f) { System.arraycopy(f, 0, flags, 0, f.length); }
  public int getSelectedFlags(boolean[] f) { System.arraycopy(flags, 0, f, 0, f.length); return 0; }
  public int getSelectedIndex() { return 0; }
}'''
F['javax/microedition/lcdui/Form.java'] = '''package javax.microedition.lcdui;
public class Form extends Screen {
  int n;
  public Form(String t) {}
  public int append(String s) { return n++; }
  public int append(Item i) { return n++; }
  public void delete(int i) { n--; }
  public int size() { return n; }
}'''
F['javax/microedition/lcdui/Item.java'] = '''package javax.microedition.lcdui;
public abstract class Item {}'''
F['javax/microedition/lcdui/StringItem.java'] = '''package javax.microedition.lcdui;
public class StringItem extends Item { public StringItem(String a, String b) {} }'''
F['javax/microedition/lcdui/TextBox.java'] = '''package javax.microedition.lcdui;
public class TextBox extends Screen { public TextBox(String a, String b, int c, int d) {} public String getString() { return ""; } }'''
F['javax/microedition/lcdui/Alert.java'] = '''package javax.microedition.lcdui;
public class Alert extends Screen { public Alert(String a, String b, Image i, AlertType t) {} public void setTimeout(int t) {} }'''
F['javax/microedition/lcdui/AlertType.java'] = '''package javax.microedition.lcdui;
public class AlertType { public static final AlertType ERROR = new AlertType(), INFO = new AlertType(); }'''
F['javax/microedition/rms/RecordStore.java'] = '''package javax.microedition.rms;
public class RecordStore {
  public static RecordStore openRecordStore(String n, boolean c) { return new RecordStore(); }
  public int getNumRecords() { return 0; }
  public int getRecord(int id, byte[] b, int off) { return 0; }
  public void setRecord(int id, byte[] b, int off, int n) {}
  public int addRecord(byte[] b, int off, int n) { return 1; }
  public void closeRecordStore() {}
}'''
F['javax/microedition/io/Connection.java'] = '''package javax.microedition.io;
public interface Connection { void close() throws java.io.IOException; }'''
F['javax/microedition/io/InputConnection.java'] = '''package javax.microedition.io;
public interface InputConnection extends Connection { java.io.InputStream openInputStream() throws java.io.IOException; }'''
F['javax/microedition/io/HttpConnection.java'] = '''package javax.microedition.io;
public interface HttpConnection extends InputConnection {}'''
F['javax/microedition/io/Connector.java'] = '''package javax.microedition.io;
public class Connector {
  public static String root = ".";
  public static Connection open(String s) throws java.io.IOException { throw new java.io.IOException("no net"); }
  public static java.io.InputStream openInputStream(String s) throws java.io.IOException {
    String p = s.replace("resource:", "").replace('\\\\', '/');
    return new java.io.BufferedInputStream(new java.io.FileInputStream(root + "/" + p));
  }
}'''
F['com/siemens/mp/color_game/Layer.java'] = '''package com.siemens.mp.color_game;
public abstract class Layer {
  public int x, y; public boolean visible = true; public int w, h;
  public void setPosition(int a, int b) { x = a; y = b; }
  public boolean isVisible() { return visible; }
  public void setVisible(boolean v) { visible = v; }
  public abstract void paint(javax.microedition.lcdui.Graphics g);
}'''
F['com/siemens/mp/color_game/Sprite.java'] = '''package com.siemens.mp.color_game;
import javax.microedition.lcdui.*;
public class Sprite extends Layer {
  public int frame, frames, cx, cy, cw, ch;
  public Sprite(Image i) { this(i, i.getWidth(), i.getHeight()); }
  public Sprite(Image i, int fw, int fh) { w = fw; h = fh; frames = (i.getWidth() / fw) * (i.getHeight() / fh); cw = fw; ch = fh; }
  public void setFrame(int f) { if (f < 0 || f >= frames) throw new IndexOutOfBoundsException("frame " + f); frame = f; }
  public int getFrame() { return frame; }
  public void setCollisionRectangle(int a, int b, int c, int d) { cx = a; cy = b; cw = c; ch = d; }
  public boolean collidesWith(Sprite o, boolean px) {
    if (!visible || !o.visible) return false;
    int ax = x + cx, ay = y + cy, bx = o.x + o.cx, by = o.y + o.cy;
    return ax < bx + o.cw && bx < ax + cw && ay < by + o.ch && by < ay + ch;
  }
  public void paint(Graphics g) {}
}'''
F['com/siemens/mp/color_game/LayerManager.java'] = '''package com.siemens.mp.color_game;
public class LayerManager {
  public java.util.ArrayList<Layer> l = new java.util.ArrayList<>();
  public void append(Layer x) { l.remove(x); l.add(x); }
  public void paint(javax.microedition.lcdui.Graphics g, int a, int b) {}
}'''
F['com/siemens/mp/color_game/GameCanvas.java'] = '''package com.siemens.mp.color_game;
public abstract class GameCanvas extends javax.microedition.lcdui.Canvas {
  protected GameCanvas(boolean b) {}
  public void flushGraphics() {}
}'''
F['com/siemens/mp/game/Sound.java'] = '''package com.siemens.mp.game;
public class Sound { public static int n; public static void playTone(int f, int d) { n++; } }'''
F['com/siemens/mp/game/Vibrator.java'] = '''package com.siemens.mp.game;
public class Vibrator { public static long total; public static void triggerVibrator(int ms) { total += ms; } }'''
F['com/siemens/mp/game/Light.java'] = '''package com.siemens.mp.game;
public class Light { public static void setLightOn() {} public static void setLightOff() {} }'''
F['com/siemens/mp/io/ConnectionListener.java'] = '''package com.siemens.mp.io;
public interface ConnectionListener { void receiveData(byte[] b); }'''
F['com/siemens/mp/io/Connection.java'] = '''package com.siemens.mp.io;
public class Connection { public Connection(String s) {} public void send(byte[] b) {} public void setListener(ConnectionListener l) {} }'''
F['com/siemens/mp/media/Player.java'] = '''package com.siemens.mp.media;
public interface Player { int getState(); void prefetch(); void realize(); void start(); void stop(); }'''
F['com/siemens/mp/media/Manager.java'] = '''package com.siemens.mp.media;
public class Manager {
  public static StringBuilder log = new StringBuilder();
  public static String[] getSupportedContentTypes(String p) { return new String[] { "audio/midi", "application/x-smaf" }; }
  public static Player createPlayer(final String name) {
    return new Player() {
      public int getState() { return 300; }
      public void prefetch() {}
      public void realize() {}
      public void start() { log.append(name).append(";"); }
      public void stop() {}
    };
  }
}'''
for path, src in F.items():
    full = os.path.join(root, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    open(full, 'w').write(src + '\n')
print(len(F), 'stubs')

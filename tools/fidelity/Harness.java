import java.io.*;
import java.lang.reflect.*;
import java.util.*;
import com.siemens.mp.color_game.*;

/** Drives the ORIGINAL obfuscated game class `e` frame by frame and dumps its state. */
public class Harness {
  static e G;
  static Class<?> E = e.class;

  static Field f(Class<?> c, String n) throws Exception { Field x = c.getDeclaredField(n); x.setAccessible(true); return x; }
  static Object sget(String n) throws Exception { return f(E, n).get(null); }
  static Object iget(Object o, String n) throws Exception { return f(o.getClass(), n).get(o); }
  static boolean sb(String n) throws Exception { return f(E, n).getBoolean(null); }
  static int si(String n) throws Exception { return f(E, n).getInt(null); }
  static void sset(String n, Object v) throws Exception { f(E, n).set(null, v); }
  static Object call(String n, Class<?>[] t, Object... a) throws Exception { Method m = E.getDeclaredMethod(n, t); m.setAccessible(true); return m.invoke(G, a); }
  static Object call(String n) throws Exception { return call(n, new Class<?>[0]); }

  public static void main(String[] args) throws Exception {
    String jar = args[0];
    long seed = Long.parseLong(args[1]);
    int level = Integer.parseInt(args[2]), ch = Integer.parseInt(args[3]), unl = Integer.parseInt(args[4]);
    int frames = Integer.parseInt(args[5]);
    List<String> script = java.nio.file.Files.readAllLines(new File(args[6]).toPath());
    PrintWriter out = new PrintWriter(new BufferedWriter(new FileWriter(args[7])));
    javax.microedition.io.Connector.root = jar;

    new c();
    d dd = new d();
    d.i = level; d.a = ch; d.b = unl; d.e = 0; d.k = 0;
    StackAttack2.l = new Random(seed);
    StackAttack2.d = new f(99);
    StackAttack2.a = new Thread();
    m mm = new m();
    mm.a("res-head.bin", "res.bin");
    G = new e(dd, mm, null, javax.microedition.lcdui.Display.getDisplay(null));

    // run() prologue
    sset("at", true);
    call("c");
    call("B");
    int Y = f(E, "Y").getInt(G);
    Object[] ad = (Object[]) f(E, "ad").get(G);
    LayerManager ae = (LayerManager) f(E, "ae").get(G);
    for (int n = 0; n < Y; n++) { ((j) ad[n]).d(); ae.append((Layer) ad[n]); }

    g ao = (g) f(E, "ao").get(G);
    l ar = (l) f(E, "ar").get(G);
    Sprite P = (Sprite) f(E, "P").get(G), N = (Sprite) f(E, "N").get(G), H = (Sprite) f(E, "H").get(G), O = (Sprite) f(E, "O").get(G);
    Sprite S = (Sprite) f(E, "S").get(G), R = (Sprite) f(E, "R").get(G), Q = (Sprite) f(E, "Q").get(G);

    for (int fr = 0; fr < frames && sb("at"); fr++) {
      String line = fr < script.size() ? script.get(fr).trim() : "-";
      if (!line.equals("-")) { String[] p = line.split(" "); b.an = Integer.parseInt(p[0]); b.ac = Integer.parseInt(p[1]); }
      String err = "";
      try {
        if (!sb("p") && (Integer) call("g") == 0) {
          if (sb("l") && !sb("au")) { sset("au", true); }
          ao.d();
          call("u"); call("f"); call("h"); call("a"); call("s");
          if (ar.b()) { call("a", new Class<?>[] { int.class }, 10 * f(E, "Y").getInt(G)); call("b"); e.d(9); e.b(500); }
          int av = si("av");
          if (av > 0) { P.setVisible(true); P.setFrame(av - 1); } else P.setVisible(false);
          N.setVisible(sb("Z")); H.setVisible(sb("I"));
          O.setFrame(ao.b > 7 ? 8 : ao.b + 1);
          sset("k", false);
          if (!sb("T") && b.an == -12) {
            if (b.ac == 1 || b.ac == 2) { sset("at", false); sset("ap", 0); sset("T", true); }
          } else if (sb("T")) {
            if (si("ap") != 0) sset("ap", si("ap") - 1);
            else if (b.ac == 1 || b.ac == 2) sset("at", false);
          }
        } else if (sb("o")) {
          S.setVisible(false); R.setVisible(false); Q.setVisible(false);
          if (b.an == 48 && b.ac == 1) { sset("p", false); sset("o", false); b.an = 0; }
        }
      } catch (InvocationTargetException ex) {
        err = " EXC " + ex.getCause();
      } catch (Exception ex) {
        err = " EXC " + ex;
      }
      out.println(dump(fr, ao, ar, ad, S, R, Q, O, P) + err);
      if (!err.isEmpty()) break;
    }
    out.close();
  }

  static int gi(Object o, String n) throws Exception { return ((Number) iget(o, n)).intValue(); }

  static String dump(int fr, g ao, l ar, Object[] ad, Sprite S, Sprite R, Sprite Q, Sprite O, Sprite P) throws Exception {
    StringBuilder sb = new StringBuilder();
    sb.append(fr).append(" sc=").append(si("ab"));
    sb.append(" pl=").append(ao.f).append(',').append(ao.d).append(',').append(ao.k).append(',').append(ao.b).append(',').append(ao.x)
      .append(',').append(gi(ao, "z")).append(',').append(gi(ao, "y")).append(',').append(gi(ao, "i")).append(',').append(gi(ao, "c")).append(',').append(ao.getFrame());
    sb.append(" av=").append(si("av")).append(" Z=").append(sb("Z") ? 1 : 0).append(" I=").append(sb("I") ? 1 : 0).append(" T=").append(sb("T") ? 1 : 0)
      .append(" p=").append(sb("p") ? 1 : 0).append(sb("o") ? 1 : 0).append(" K=").append(si("K")).append(" as=").append(sb("as") ? 1 : 0)
      .append(" M=").append(sb("M") ? 1 : 0).append(sb("m") ? 1 : 0).append(sb("y") ? 1 : 0).append(sb("l") ? 1 : 0)
      .append(" s=").append(si("s")).append(" ap=").append(si("ap"));
    sb.append(" pop=").append(f(E, "ai").getInt(G)).append(',').append(f(E, "ah").getInt(G)).append(',').append(f(E, "ag").getInt(G))
      .append(',').append(S.visible && S.x >= 0 ? 1 : 0).append(R.visible && R.x >= 0 ? 1 : 0).append(Q.visible && Q.x >= 0 ? 1 : 0).append(',').append(S.frame).append(R.frame).append(Q.frame);
    sb.append(" hud=").append(O.frame).append(',').append(P.visible ? P.frame : -1);
    sb.append(" cr=");
    for (Object o : ad) {
      j c = (j) o;
      sb.append(c.d).append(',').append(c.b).append(',').append(gi(c, "a")).append(',').append(c.c).append(',').append(c.e).append(',').append(c.f).append(';');
    }
    boolean[] aa = (boolean[]) sget("aa");
    sb.append(" aa=");
    for (boolean x : aa) sb.append(x ? 1 : 0);
    sb.append(" g=");
    for (int r = 0; r < 7; r++)
      for (int c = 0; c < 12; c++) {
        i cr = ar.b[c][r];
        if (cr.c == -1 && !cr.isVisible()) { sb.append('.'); continue; }
        sb.append('[').append(c).append(':').append(r).append(' ').append(cr.c).append(',').append(cr.h).append(',').append(cr.f).append(',').append(cr.a)
          .append(',').append(cr.x).append(',').append(cr.y).append(',').append(cr.isVisible() ? 1 : 0).append(',').append(cr.g).append(',').append(cr.d ? 1 : 0).append(']');
      }
    return sb.toString();
  }
}
